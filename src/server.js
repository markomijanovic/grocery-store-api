import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 3000) // load port from env but if not defined use 3000

app.get('/health',(req, res)=>{
    res.status(200).json({status: "ok"});
});

app.listen(port, '127.0.0.1', ()=>{
    console.log(`Server is running at http://127.0.0.1:${port}`);
});