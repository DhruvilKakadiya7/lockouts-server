import express from 'express';
import nodemailer from 'nodemailer';
const mailRouter = express.Router();
var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'lockoutsbot@gmail.com',
        pass: 'jzrq fzjf dxge ltdt'
    }
});
mailRouter.post('/', async (req, res) => {
    const mailContent = req.body;
    var mailOptions = {
        from: 'lockoutsbot@gmail.com',
        to: 'kakadiyadhruvil3006@gmail.com',
        subject: `New response on LockOuts from ${mailContent.name}`,
        text: `${mailContent.message}\n\n${mailContent.email}`
    };
    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
    res.send('ok');
});

export default mailRouter;