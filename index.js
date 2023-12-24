const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId} = require('mongodb');
require("dotenv").config();

const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const saltRounds = 10;

const app = express();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ieei5.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", (req, res) => {
    res.send("server working");
  });

let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
       user: process.env.EMAIL,
       pass: process.env.PASS
    }
 });

async function run() {
    try {
      await client.connect();
    
      const userCollection = client.db(process.env.DB_NAME).collection(process.env.DB_COL);
      //Register user API starts here
       app.post("/api/register",async (req, res) => {
        // console.log(req.body)
        try{
          const {email,password} = req.body;
           //find the current user to check whether he/she has already been registered or not
          const queryResult = userCollection.find({email: email, isVerified: true});
          const user = await queryResult.toArray();

          if(user.length == 0) { //current user did not register(new user) 
            //encrypting the password
            bcrypt.genSalt(saltRounds, (err, salt) => {
              bcrypt.hash(password, salt, async(err, hashPassword) => {
          
                const user = req.body;
                const userInfo = {...user,password:hashPassword} //added encrypted password
                const result = await userCollection.insertOne(userInfo); // insert the current user

                if(result.acknowledged){// insert has successfully done
                  //mail information containing the verification link
                  let mailOptions = {
                    from: process.env.EMAIL,
                    to: email,
                    subject: 'Verify your Account',
                    html: `<p>Click the link to verify your account: <a href="http://localhost:${process.env.PORT}/api/verification/user/${result.insertedId.valueOf()}">"http://localhost:${process.env.PORT}/api/verification/user/${result.insertedId.valueOf()}"</a></p>`,
                  };
                  //sending mail to the current user email
                  transporter.sendMail(mailOptions, (err, resp) => {
                    if(err){ // email sending failed
                      console.log(result)
                      res.send({
                        isSuccess: false,
                        message: "Please enter your email address and password correctly!"
                      })
                    }else{// email has been successfully sent
                      console.log(resp);
                      res.status(200).send({
                        isSuccess: true,
                        message: "Please check your email for the verification link!"
                      })
                    }
                  })
                }else{ // inserting new user failed
                  res.send({
                    isSuccess: false,
                    message: "Server error. Please try again later. Thank you!"
                  })
                }  
              })
            });
          }else{// user already exists
            res.send({message:"You are already registered. Please go to login page and try again."})
          }
        }catch(err){
          res.status(500).send('<div style="display:flex;align-items:center;justify-content:center;height:100vh;width:100%;color:red"><h1>Server error. Please try again later.</h1></div>');
        }
    });
    //Register user API end here

    //Account verification API starts here
    app.get("/api/verification/user/:id",async (req, res) => {
        try{
          const userId = req.params.id; // insert id of user information 
          // update the isVerified field of user info from false to true
          const updateResult = await userCollection.updateOne({ _id: new ObjectId(userId) },{$set: { isVerified: true}})
          if(updateResult.acknowledged){ // updated successfully, sending an html response
            res.status(200).send('<div style="display:flex;align-items:center;justify-content:center;height:100vh;width:100%;"><h1>Your account has been verified!! Go to login page.</h1></div>')
          }else{ // update process is failed
            res.status(500).send('<div style="display:flex;align-items:center;justify-content:center;height:100vh;width:100%;color:red"><h1>Server error. Please try again later.</h1></div>')
          }
        }catch(err){ // any errors during the process execution
          res.status(500).send('<div style="display:flex;align-items:center;justify-content:center;height:100vh;width:100%;color:red"><h1>Server error. Please try again later.</h1></div>');
        }
    })
    //Account verification API end here

    //Login API starts here
    app.post("/api/login",async (req, res) => {
        // console.log(req.body);
        try{
          const {email,password} = req.body;
          const queryResult = userCollection.find({email: email, isVerified: true}); //find the current user
          const user = await queryResult.toArray();

          if (user.length > 0) {// requested user has been in the database
            bcrypt.compare(password, user[0].password, (err, response)=> { //matching password as we encrypted the password
              if (response) { // matched the password
                res.status(200).send({
                  isSuccess: true,
                  message: "Login successful!",
                  user: user[0]
                })
              }else { // wrong password
                res.send({
                  isSuccess: false,
                  message: "Invalid email or password!"
                })
              }
            });
          }else { // the requested user does have any account or not verified ago
            // console.log("else here")
            res.send({
              isSuccess: false,
              message: "You are not an user or did not verify your account! If you did registration, please check your email for verification link."
            })
          }
        }
        catch(err){
          res.status(500).send(res.status(500).send('<div style="display:flex;align-items:center;justify-content:center;height:100vh;width:100%;color:red"><h1>Server error. Please try again later.</h1></div>'))
        }
    })
    //Login API end here

    }catch(err){

    } finally {
      // Ensures that the client will close when you finish/error
      //await client.close();
    }
  }
  run().catch(console.dir);

  app.listen(process.env.PORT || 8080,()=>{
    console.log(`server listening ${process.env.PORT}`)
  });