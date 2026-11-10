import express from 'express';
import { connectDatabase } from './db.js';

const app = express();

const port = Number(process.env.PORT ?? 3000) // load port from env but if not defined use 3000

const {db} = await connectDatabase({
    mongoUri: process.env.MONGODB_URI,
    dbName: process.env.MONGODB_DB,
});

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

app.listen(port, '127.0.0.1', ()=>{
    console.log(`Server is running at http://127.0.0.1:${port}`);
});