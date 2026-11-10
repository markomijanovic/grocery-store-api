import express from 'express';

const app = express();

app.get('/health',(req, res)=>{
    res.status(200).json({status: "ok"});
});

app.listen(3000, '127.0.0.1', ()=>{
    console.log('Server is running at http://127.0.0.1:3000');
});