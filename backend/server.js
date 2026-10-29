require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const app = express();
const PORT = Number(process.env.PORT || 3000);
app.use(cors());
const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_PASSWORD_HASH', 'JWT_SECRET'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) { console.error(`Missing required environment variables: ${missing.join(', ')}. Copy .env.example to .env and fill it in.`); process.exit(1); }
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc:["'self'"], scriptSrc:["'self'"], styleSrc:["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc:["'self'", 'https://fonts.gstatic.com', 'data:'], imgSrc:["'self'", 'data:'], connectSrc:["'self'"] } } }));
app.use(express.json({ limit: '20kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api/applications', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));
const statuses = ['applied', 'shortlisted', 'interview', 'selected', 'rejected'];
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
const emailOk = v => typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
function adminOnly(req, res, next) { const header = req.get('authorization') || ''; const token = header.startsWith('Bearer ') ? header.slice(7) : ''; try { const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }); if (decoded.role !== 'coordinator') throw new Error('Wrong role'); req.admin = true; next(); } catch { res.status(401).json({ error: 'Please sign in as coordinator.' }); } }
function handleDbError(res, error, message = 'Database request failed.') { console.error(message, error?.message || error); return res.status(500).json({ error: message }); }
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'Campus Placement Tracker' }));
app.get('/api/drives', async (req, res) => {
    try {
        const { data, error } = await supabase.from('placement_drives').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (error) {
        handleDBError(res, error, 'Database request failed.');
    }
});
app.put('/api/drives/:id', adminOnly, async (req, res) => { const b=req.body||{}; if(!text(b.company_name,100)||!text(b.role,100)||!text(b.description,1000)||!Number.isFinite(b.min_cgpa)||b.min_cgpa<0||b.min_cgpa>10||!/^\d{4}-\d{2}-\d{2}$/.test(b.deadline||'')) return res.status(400).json({error:'Please provide valid drive details.'}); const {data,error}=await supabase.from('placement_drives').update({company_name:b.company_name.trim(),role:b.role.trim(),description:b.description.trim(),min_cgpa:b.min_cgpa,deadline:b.deadline}).eq('id',req.params.id).select().maybeSingle(); if(error)return handleDbError(res,error,'Could not update the drive.'); if(!data)return res.status(404).json({error:'Drive not found.'}); res.json({drive:data}); });
app.patch('/api/drives/:id/status', adminOnly, async(req,res)=>{const status=req.body?.status;if(!['open','closed'].includes(status))return res.status(400).json({error:'Status must be open or closed.'});const {data,error}=await supabase.from('placement_drives').update({status}).eq('id',req.params.id).select().maybeSingle();if(error)return handleDbError(res,error,'Could not update drive status.');if(!data)return res.status(404).json({error:'Drive not found.'});res.json({drive:data});});
app.post('/api/applications', async (req,res)=>{const b=req.body||{};if(!text(b.student_name,100)||!emailOk(b.student_email)||!text(b.roll_number,30)||!Number.isFinite(b.cgpa)||b.cgpa<0||b.cgpa>10||!text(b.drive_id,80))return res.status(400).json({error:'Please complete all fields with valid values.'});const {data:drive,error:driveError}=await supabase.from('placement_drives').select('id,status,min_cgpa,deadline,company_name,role').eq('id',b.drive_id).maybeSingle();if(driveError)return handleDbError(res,driveError,'Could not verify this placement drive.');if(!drive||drive.status!=='open')return res.status(400).json({error:'This placement drive is not available.'});if(drive.deadline<new Date().toISOString().slice(0,10))return res.status(400).json({error:'The application deadline has passed.'});if(b.cgpa<Number(drive.min_cgpa))return res.status(400).json({error:`This drive requires a minimum CGPA of ${drive.min_cgpa}.`});const {data,error}=await supabase.from('applications').insert({drive_id:drive.id,student_name:b.student_name.trim(),student_email:b.student_email.trim().toLowerCase(),roll_number:b.roll_number.trim().toUpperCase(),cgpa:b.cgpa}).select('id').single();if(error&&error.code==='23505')return res.status(409).json({error:'An application for this drive already exists for this roll number.'});if(error)return handleDbError(res,error,'Could not submit the application.');res.status(201).json({message:'Application submitted successfully.',application_id:data.id});});
app.get('/api/applications',adminOnly,async(req,res)=>{const {data,error}=await supabase.from('applications').select('id,student_name,student_email,roll_number,cgpa,status,created_at,placement_drives(company_name,role)').order('created_at',{ascending:false});if(error)return handleDbError(res,error,'Could not load applications.');res.json({applications:(data||[]).map(a=>({id:a.id,student_name:a.student_name,student_email:a.student_email,roll_number:a.roll_number,cgpa:a.cgpa,status:a.status,created_at:a.created_at,company_name:a.placement_drives?.company_name||'Unknown company',role:a.placement_drives?.role||'Unknown role'}))});});
app.patch('/api/applications/:id/status',adminOnly,async(req,res)=>{const status=req.body?.status;if(!statuses.includes(status))return res.status(400).json({error:`Status must be one of: ${statuses.join(', ')}.`});const {data,error}=await supabase.from('applications').update({status}).eq('id',req.params.id).select('id,status').maybeSingle();if(error)return handleDbError(res,error,'Could not update application status.');if(!data)return res.status(404).json({error:'Application not found.'});res.json({application:data});});
app.use('/api', (req,res)=>res.status(404).json({error:'API endpoint not found.'}));
app.use((err,req,res,next)=>{if(err instanceof SyntaxError && 'body' in err)return res.status(400).json({error:'Invalid JSON request body.'});console.error('Unexpected server error:',err.message);res.status(500).json({error:'An unexpected server error occurred.'});});
app.listen(PORT,()=>console.log(`Campus Placement Tracker running at http://localhost:${PORT}`));
