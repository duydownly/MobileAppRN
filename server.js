const express = require('express');
const cors = require('cors');
const { client, connectDB } = require('./db');
const bodyParser = require('body-parser');
const moment = require('moment-timezone');
const transporter = require('./mailConfig'); // Import the transporter
const { notifyEmailConfirmed } = require('./ws');

const app = express();

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors()); // Enable CORS if needed
app.use(bodyParser.json());

// Import database connection
connectDB();
//get list of employees        
app.post('/sendTestEmail', async (req, res) => {
  const { toEmail, subject, text } = req.body;

  if (!toEmail || !subject || !text) {
    return res.status(400).json({ error: 'Recipient email, subject, and text are required' });
  }

  try {
    const mailOptions = {
      from: 'duygiodalonroi1102@gmail.com',
      to: toEmail,
      subject: subject,
      text: text
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});                                                
app.get('/getAllEmployees', async (req, res) => {
  try {
    const { admin_id } = req.query;

    // Log admin_id vào console
    console.log('Received admin_id:', admin_id);

    const query = `
      SELECT 
        e.id, 
        e.name, 
        e.phone, 
        e.email, 
        e.cmnd AS idNumber, 
        e.birth_date AS dob, 
        e.address, 
        e.status, 
        e.password,
        s.salaries AS amount
      FROM employees e
      JOIN salaries s ON e.id = s.employee_id
      WHERE e.admin_id = $1
      ORDER BY e.id;
    `;
    const result = await client.query(query, [admin_id]);

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});




//update employee password (account)                                            
app.patch('/updatePasswordEmployee', async (req, res) => {
  const { employee_id, newPassword } = req.body;

  if (!employee_id || !newPassword) {
    return res.status(400).json({ error: 'employee_id and newPassword are required' });
  }

  try {
    const query = 'UPDATE employees SET password = $1 WHERE id = $2 RETURNING *';
    const values = [newPassword, employee_id];
    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


//update admin password (account)                                            
app.patch('/updatePasswordAdmin', async (req, res) => {
  const { admin_id, newPassword } = req.body;

  if (!admin_id || !newPassword) {
    return res.status(400).json({ error: 'adminID and newPassword are required' });
  }

  try {
    const query = 'UPDATE users SET password = $1 WHERE id = $2 RETURNING *';
    const values = [newPassword, admin_id];
    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'account not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


//get attendance data (schedule screen)                                              
app.get('/formattedAttendance', async (req, res) => {
  try {
    const { admin_id } = req.query;

    const query = `
      SELECT e.id as employee_id, e.name, a.status, a.date as datetime, a.color, e.admin_id
      FROM employees e
      LEFT JOIN attendance a ON e.id = a.employee_id
      WHERE e.admin_id = $1
      ORDER BY e.id, a.date;
    `;
    const result = await client.query(query, [admin_id]);

    const employees = {};
    result.rows.forEach(row => {
      if (!employees[row.employee_id]) {
        employees[row.employee_id] = {
          id: row.employee_id,
          name: row.name,
          attendance: []
        };
      }
      employees[row.employee_id].attendance.push({
        status: row.status,
        datetime: row.datetime,
        color: row.color
      });
    });

    res.json(Object.values(employees));
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});


//insert attendance for an employee (schedule screen)
app.post('/insertAttendance', async (req, res) => {
  const { employee_id, date, status, color } = req.body;

  console.log('Request Body:', req.body);

  if (!employee_id || !date || !status || !color) {
    return res.status(400).json({ error: 'All fields (employee_id, date, status, color) are required' });
  }

  try {
    const query = `
      INSERT INTO attendance (employee_id, date, status, color)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (employee_id, date)
      DO NOTHING
      RETURNING *;
    `;
    const values = [employee_id, date, status, color];
    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Attendance record already exists' });
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


//update attendance for an employee (schedule screen)
app.patch('/updateAttendance', async (req, res) => {
  const { employee_id, date, status, color } = req.body;

  console.log('Request Body:', req.body);

  if (!employee_id || !date || !status || !color) {
    return res.status(400).json({ error: 'All fields (employee_id, date, status, color) are required' });
  }

  try {
    const query = `
      UPDATE attendance
      SET status = $1, color = $2
      WHERE employee_id = $3 AND date = $4
      RETURNING *;
    `;
    const values = [status, color, employee_id, date];
    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


//ban an employee (employee tab)
app.patch('/banEmployee', async (req, res) => {
  const { employee_id } = req.body;

  // Validate employee_id
  if (!employee_id) {
    return res.status(400).json({ error: 'Employee ID is required' });
  }

  try {
    const query = 'UPDATE employees SET status = $1 WHERE id = $2 RETURNING *';
    const values = ['Banned', employee_id];
    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    console.log(`Employee ${employee_id} status updated to Banned`);
    res.status(200).json({ message: 'Employee status updated to Banned', employee: result.rows[0] });
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.patch('/unbanEmployee', async (req, res) => {
  const { employee_id } = req.body;

  // Validate employee_id
  if (!employee_id) {
    return res.status(400).json({ error: 'Employee ID is required' });
  }

  try {
    const query = 'UPDATE employees SET status = $1 WHERE id = $2 RETURNING *';
    const values = ['Active', employee_id];
    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    console.log(`Employee ${employee_id} status updated to Active`);
    res.status(200).json({ message: 'Employee status updated to Active', employee: result.rows[0] });
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
//add a new employee (emloyee tab)                                                 
app.post('/addEmployee', async (req, res) => {
  const { name, dob, address, idNumber, phone, email, password, paymentType, amount, admin_id } = req.body;

  try {

    // Insert new employee
    const insertEmployeeQuery = `
      INSERT INTO employees (name, phone, email, password, cmnd, birth_date, address, status, admin_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
      RETURNING id;
    `;
    const employeeValues = [name, phone, email, password, idNumber, dob, address, admin_id];
    const employeeResult = await client.query(insertEmployeeQuery, employeeValues);
    
    const employee_id = employeeResult.rows[0].id;
    
    // Insert salary for the new employee
    const insertSalaryQuery = `
      INSERT INTO salaries (employee_id, type, salaries)
      VALUES ($1, $2, $3);
    `;
    const salaryValues = [employee_id, paymentType, amount];
    await client.query(insertSalaryQuery, salaryValues);
   
    res.status(201).json({ message: 'Employee and salary added successfully', employee_id });
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).json({ error: 'Internal Server Error' });
  } 
});

//update employee information (Employee tab)
app.put('/updateEmployeeField', async (req, res) => {
  const { employee_id, field, value } = req.body;

  try {
    let query = '';
    let values = [value, employee_id];

    // Check which field needs to be updated and construct the query accordingly
    switch (field) {
      case 'name':
        query = 'UPDATE employees SET name = $1 WHERE id = $2';
        break;
      case 'dob':
        query = 'UPDATE employees SET birth_date = $1 WHERE id = $2';
        break;
      case 'address':
        query = 'UPDATE employees SET address = $1 WHERE id = $2';
        break;
      case 'idNumber':
        query = 'UPDATE employees SET cmnd = $1 WHERE id = $2';
        break;
      case 'phone':
        query = 'UPDATE employees SET phone = $1 WHERE id = $2';
        break;
      case 'email':
        query = 'UPDATE employees SET email = $1 WHERE id = $2';
        break;
      case 'password':
        query = 'UPDATE employees SET password = $1 WHERE id = $2';
        break;
      case 'paymentType':
        query = 'UPDATE salaries SET type = $1 WHERE employee_id = $2';
        break;
      case 'amount':
        query = 'UPDATE salaries SET salaries = $1 WHERE employee_id = $2';
        break;
      default:
        return res.status(400).json({ error: 'Invalid field' });
    }

    await client.query(query, values);

    res.status(200).json({ message: 'Employee field updated successfully' });
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//Get account information (account)                                                          
app.get('/accountInformation', async (req, res) => {
  const { employee_id } = req.body;

  try {
    // Query to get employee information excluding id and password
    const query = `
      SELECT id, name, phone, email, password, cmnd AS idNumber, birth_date AS dob, address, status
      FROM employees
      WHERE id = $1;
    `;
    const result = await client.query(query, [employee_id]);

    // Check if employee exists
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.status(200).json(result.rows[0]);

  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).json({ error: 'Internal Server Error' });
  } 
});

//calculate salary for month (EmployeeTab)                                             //need fix admin id//
app.get('/calculateTotalSalaries', async (req, res) => {
  try {
    const { admin_id } = req.query;

    // Query to calculate total salaries for each employee for each month, filtered by admin_id
    const query = `
      WITH months AS (
        SELECT DISTINCT TO_CHAR(date, 'YYYY-MM') AS month
        FROM attendance
      )
      SELECT 
        m.month,
        e.id AS employee_id,
        e.name,
        COALESCE(s.salaries, 0) AS daily_salary,
        COUNT(a.date) FILTER (WHERE a.status = 'Attended') AS present_days,
        COALESCE(COUNT(a.date) FILTER (WHERE a.status = 'Attended') * s.salaries, 0) AS total_salary
      FROM 
        months m
      CROSS JOIN 
        employees e
      LEFT JOIN 
        salaries s ON e.id = s.employee_id
      LEFT JOIN 
        attendance a ON e.id = a.employee_id AND TO_CHAR(a.date, 'YYYY-MM') = m.month
      WHERE 
        e.admin_id = $1
      GROUP BY 
        m.month, e.id, e.name, s.salaries
      ORDER BY 
        m.month, e.id;
    `;

    const result = await client.query(query, [admin_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No data found' });
    }

    // Calculate total salaries for each month
    const monthlySalaries = result.rows.reduce((acc, row) => {
      const { month, employee_id, name, total_salary } = row;

      if (!acc[month]) {
        acc[month] = {
          totalSalaryForMonth: 0,
          employees: [],
        };
      }

      acc[month].totalSalaryForMonth += parseFloat(total_salary);
      acc[month].employees.push({
        employee_id,
        name,
        total_salary,
      });

      return acc;
    }, {});

    res.status(200).json({
      message: 'Total salaries for each month calculated successfully',
      monthlySalaries,
    });
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//check in
app.post('/checkIn', async (req, res) => {
  const { employee_id } = req.body;

  if (!employee_id) {
    return res.status(400).json({ error: 'Employee ID is required' });
  }

  try {
    const currentDate = moment().tz('Asia/Bangkok').format('YYYY-MM-DD');

    const query = `
      INSERT INTO attendance (employee_id, date, status, color)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (employee_id, date)
      DO NOTHING
      RETURNING *;
    `;
    const values = [employee_id, currentDate, 'Attended', '#00FF00'];
    const result = await client.query(query, values);

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Create the user with Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      emailVerified: false,
      // Set other properties as needed
    });

    // Generate email verification link
    const emailVerificationLink = await admin.auth().generateEmailVerificationLink(email);

    // Send verification email using Nodemailer
    await transporter.sendMail({
      from: 'no-reply@example.com',
      to: email,
      subject: 'Please verify your email address',
      text: `Click the following link to verify your email address: ${emailVerificationLink}`,
    });

    res.status(200).json({
      message: 'User signed up successfully. Verification email sent.',
      userId: userRecord.uid,
      emailVerificationLink
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// login for admin
app.post('/loginAdmin', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists in the local database
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length > 0) {
      const user = result.rows[0];

      // Verify the password
      if (password === user.password) {
        return res.status(200).json({ message: 'Login successful', userId: user.id });
      } else {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    }

    // If user doesn't exist locally, check Firebase
    try {
      const firebaseUser = await admin.auth().getUserByEmail(email);

      // Check if the email is verified
      if (firebaseUser.emailVerified) {
        // Add the user to the local database
        const insertResult = await client.query(
          'INSERT INTO users (email, password, uid) VALUES ($1, $2, $3) RETURNING id',
          [email, password, firebaseUser.uid]
        );
        return res.status(200).json({ message: 'Email verified. Please login again' }); //return to login page not home page
      } else {
        return res.status(401).json({ message: 'Email not verified' });
      }
    } catch (error) {
      // If the user doesn't exist in Firebase, return an error
      return res.status(404).json({ message: 'Account does not exist' });
    }
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

//login for employee                                                                        //check ban//
app.post('/loginEmployee', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists in the local database
    const result = await client.query('SELECT * FROM employees WHERE email = $1', [email]);

    if (result.rows.length > 0) {
      const user = result.rows[0];

      // Verify the password
      if (password === user.password) {
        if (user.status === 'Banned'){
          return res.status(403).json({ message: 'your account is banned'});
        } else {
          return res.status(200).json({ message: 'Login successful', userId: user.id });
        }
      } else {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    } else {
      return res.status(404).json({ message: 'Account does not exist' });
    }
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});


app.get('/myAttendanceMinimal', async (req, res) => {
  try {
    const { employee_id } = req.query;

    if (!employee_id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    const query = `
      SELECT a.status, a.date AS datetime
      FROM attendance a
      WHERE a.employee_id = $1 AND a.date::date = CURRENT_DATE
      ORDER BY a.date DESC
      LIMIT 1;
    `;

    const result = await client.query(query, [employee_id]);

    if (result.rows.length === 0) {
      return res.json({ status: 'Not Checked In', datetime: new Date().toISOString().split('T')[0] });
    }

    const { status, datetime } = result.rows[0];

    // Chuyển đổi ngày từ UTC sang GMT+7 (Việt Nam)
    const utcDate = new Date(datetime);
    const vietnamOffset = 7 * 60 * 60 * 1000; // 7 giờ
    const vietnamDate = new Date(utcDate.getTime() + vietnamOffset);

    res.json({ status, datetime: vietnamDate.toISOString().split('T')[0] });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});



app.get('/employeeAttendance', async (req, res) => {
  const { employee_id } = req.query;

  if (!employee_id) {
    return res.status(400).json({ error: 'Employee ID is required' });
  }

  const currentDate = new Date().toISOString().split('T')[0]; // Trường Date bình thường

  try {
    const query = `
      SELECT e.id as employee_id, e.name, a.status, TO_CHAR(a.date, 'YYYY-MM-DD') as datetime, a.color
      FROM employees e
      LEFT JOIN attendance a ON e.id = a.employee_id
      WHERE e.id = $1
      ORDER BY a.date;
    `;
    const values = [employee_id];
    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No attendance records found for this employee' });
    }

    const employee = {
      id: result.rows[0].employee_id,
      name: result.rows[0].name,
      attendance: result.rows.map(row => ({
        status: row.status,
        datetime: row.datetime,
        color: row.color
      }))
    };

    // Trả về thông tin nhân viên và ngày hiện tại
    return res.json({
      employee,
      currentDate
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'An error occurred while fetching attendance records' });
  }
});
let tempUsers = {};

app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  // Tạo mã xác nhận đơn giản dựa trên timestamp
  const token = Date.now().toString();

  // Lưu email, password và token vào bộ nhớ tạm
  tempUsers[token] = { email, password };

  const confirmLink = `http://localhost:3000/confirm?token=${token}`;

  // Gửi email xác nhận
  transporter.sendMail({
      from: 'duygiodalonroi1102@gmail.com',
      to: email,
      subject: 'Email Confirmation',
      text: `Click the link to confirm your email: ${confirmLink}`
  }, (err, info) => {
      if (err) {
          console.error(err);
          res.status(500).send('Error sending email.');
      } else {
          res.status(200).send('Registration email sent. Please check your inbox.');
      }
  });
});
app.get('/confirm', async (req, res) => {
  const token = req.query.token;

  // Kiểm tra token có hợp lệ không
  const userData = tempUsers[token];

  if (!userData) {
      return res.status(400).send('Invalid or expired token.');
  }

  const { email, password } = userData;

  try {
      await client.query('INSERT INTO users (email, password) VALUES ($1, $2);', [email, password]);
      console.log('User registered successfully.');

      delete tempUsers[token];

      // Gửi thông báo qua WebSocket khi email được xác nhận
      notifyEmailConfirmed(token);

      res.status(200).send('Email confirmed and user registered.');
  } catch (err) {
      console.error('Error inserting user into database:', err);
      res.status(500).send('Error registering user.');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});












