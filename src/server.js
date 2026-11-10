import express from 'express';
import { connectDatabase } from './db.js';
import { readConfig } from './config.js';
const app = express();


const config = readConfig();

const {db} = await connectDatabase(config);

console.log("Connected to mongo!");

app.get('/health',(req, res)=>{
    res.status(200).json({status: "ok"});
});

app.get('/ready',async(req,res)=>{
    try{
        await db.command({ping : 1});

        res.status(200).json({status:"ready"});
    }catch{
        res.status(503).json({status:"not_ready"});
    }
})

app.listen(config.port, '127.0.0.1', ()=>{
    console.log(`Server is running at http://127.0.0.1:${config.port}`);
});