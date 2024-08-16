// mailConfig.js

const nodemailer = require('nodemailer');

// Create a transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'duygiodalonroi1102@gmail.com', // Your Gmail email
        pass: 'ljhd ppyk eewd tnxb'          // Your app password
    }
});

module.exports = transporter;
let tempUsers = {};
