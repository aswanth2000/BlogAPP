var express = require("express");
var app = express();
const fs = require('fs');
var mongoose = require("mongoose");
var bodyParser = require("body-parser");
var methodOverride = require("method-override");
var passport = require("passport");
var LocalStrategy = require("passport-local");
var User = require("./models/user");
const multer = require('multer');
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'uploads/images');
        },
        filename: (req, file, cb) => {
            const name = (file.originalname);
            cb(null, name);
        }
    })
});
const AWS = require('aws-sdk');
AWS.config.update({
    accessKeyId: 'ASIA5EUF3N2CEOO4JDNG',
    secretAccessKey: 'zsDn21I+jq6zwKM0vQT0yKIwafJ4RvqoC1hZjtZA',
    sessionToken: 'FwoGZXIvYXdzEI///////////wEaDOOHAOC5EG5cQnb3PiLWAbTE5UiGvrQqW1uneeBA2rQrxDxNxSBd96lWsM2R0lI8Gr7GQB1p/AlsvG7CW1rjBr5zJiATX5VDGJfYP6Mo4GEMXFA7ntEmq94HkOVEix6x0KVFobByivbFwe/hL/sQp1BS86NKttuP0sivG5xc8tmmYYp+3CBZs821aU60ZZIDCCv3TAZ6FsYGD/mJZLBEijXqIFu0K4dcz/+rQwJJGjCFiY6erLNeoBpB431Po9laM1i5e6GxLS+b6fJUqMqoFo4coBAE0+RpsiYRW2cyZ0deqKRIfTUo14jD/QUyLS7x/hM6I8nq74rYUe/kJis1dCul/ruI0Pt2pH5kJZi/4GJoG/Q2/LbuMWgDMw==',
    region: 'us-east-1'
});
var flash = require("connect-flash");
var s3bucket = new AWS.S3();
app.use(flash());
app.use(methodOverride("_method"));

mongoose.connect("mongodb://localhost/blogapp", { useUnifiedTopology: true, useNewUrlParser: true, useFindAndModify: false });
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use('/uploads', express.static("uploads"));
app.use(require("express-session")({
    secret: "Dhoni is the best captain in the world",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

var blogSchema = new mongoose.Schema({
    title: String,
    image: String,
    body: String,
    created: { type: Date, default: Date(Date.now()) },
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: String
    }
});
var Blog = mongoose.model("Blog", blogSchema);


//     title: "Test",
//     image: "https://images6.alphacoders.com/977/thumb-350-977095.jpg",
//     body: "Test Blog Post Works"
// }, function(err, newBlog) {
//     if (err) {
//         console.log("Something went Wrong");
//     } else {
//         console.log(newBlog);
//     }
// });

// Routes

app.get("/", function(req, res) {
    res.redirect("/blogs");
})

app.get("/blogs", function(req, res) {
    currentUser = req.user;
    var msg = String(req.flash("Success"));
    console.log(msg);
    console.log(msg.length);
    Blog.find({}, function(err, blogs) {
        if (err) {
            console.log("Problem in Home Page Showing");
        } else {
            res.render("index", { blogs: blogs, currentUser: currentUser, msg: msg });
        }
    })

});
app.get("/blogs/new", isLoggedIn, function(req, res) {
    currentUser = req.user;
    var msg = String(req.flash("error"));
    console.log(msg);
    console.log(msg.length);
    res.render("new", { currentUser: currentUser, msg: msg });
});

app.post("/blogs", isLoggedIn, upload.single('photo'), async function(req, res) {
    currentUser = req.user;
    if (req.file) {

        console.log(req.file);
        console.log(req.file.filename);
        console.log(req.file.destination);
        var image = "https://aswanth2000cloud.s3.amazonaws.com/" + req.body.blog.title;
        console.log(image);

        var params = {
            Bucket: 'aswanth2000cloud',
            Key: req.body.blog.title,
            Body: fs.createReadStream(req.file.path),
            ACL: 'public-read'
        };
        await s3bucket.putObject(params, function(err, data) {
            if (err) {
                return console.log("Error storing picture");
            } else {
                return console.log("Successfully stored Todo details!");
            }
        });
        var author = {
            id: req.user._id,
            username: req.user.username
        };
        //var image = req.body.image;


        var newPost = { title: req.body.blog.title, image: image, body: req.body.blog.body, author: author }
            // console.log(req.body.blog.title);
            // console.log(req.body.blog.body);

        await Blog.create(newPost, function(err, newBlog) {
            if (err) {
                console.log("Error in Creation!");
            } else {
                res.redirect("/blogs");
            }
        });
    } else {
        req.flash("error", "File Not Chosen Please Try Again");
        res.redirect("/blogs/new");
    }

});
app.get("/blogs/:id", isLoggedIn, function(req, res) {
    currentUser = req.user;
    var msg = String(req.flash("error"));
    console.log(msg);
    console.log(msg.length);
    // res.send("Show Page");
    Blog.findById(req.params.id, function(err, foundBlog) {
        if (err) {
            console.log("Error in showig specific Blog!");
        } else {
            res.render("show", { foundBlog: foundBlog, currentUser: currentUser, msg: msg });
        }
    });

});
app.get("/blogs/:id/edit", checkBlogOwnership, function(req, res) {
    currentUser = req.user;
    Blog.findById(req.params.id, function(err, editBlog) {
        if (err) {
            console.log("Error in Showing Edit Form!");
        } else {
            res.render("edit", { editBlog: editBlog, currentUser: currentUser });
        }
    })


});

app.put("/blogs/:id", checkBlogOwnership, upload.single('photo'), async function(req, res) {
    currentUser = req.user;
    console.log(req.body);
    if (req.file) {

        console.log(req.file);
        console.log(req.file.filename);
        console.log(req.file.destination);
        var image = "https://aswanth2000cloud.s3.amazonaws.com/" + req.body.blog.title;
        console.log(image);

        var params = {
            Bucket: 'aswanth2000cloud',
            Key: req.body.blog.title,
            Body: fs.createReadStream(req.file.path),
            ACL: 'public-read'
        };
        await s3bucket.putObject(params, function(err, data) {
            if (err) {
                return console.log("Error storing picture");
            } else {
                return console.log("Successfully stored Todo details!");
            }
        });
        //var image = req.body.image;


        var updatedPost = { title: req.body.blog.title, image: image, body: req.body.blog.body }
            //res.send("Post Updated!");
        await Blog.findByIdAndUpdate(req.params.id, updatedPost, function(err, updateBlog) {
            if (err) {
                console.log("Error in Updating!");
            } else {
                res.redirect("/blogs/" + req.params.id);
            }
        });
    } else {
        req.flash("error", "File Not Chosen Please Try Again");
        res.redirect("/blogs/" + req.params.id);
    }
});

app.delete("/blogs/:id", checkBlogOwnership, function(req, res) {
    currentUser = req.user;
    //res.send("Delete Page!!");
    Blog.findByIdAndDelete(req.params.id, function(err) {
        if (err) {
            console.log("Error in Deleting!");
        } else {
            res.redirect("/blogs");
        }
    })
});

//======AUTH
app.get("/register", function(req, res) {
    var msg = String(req.flash("error"));
    console.log(msg);
    console.log(msg.length);
    res.render("register", { msg, msg });
});

app.post("/register", async function(req, res) {
    var newUser = new User({ username: req.body.username });
    await User.register(newUser, req.body.password, async function(err, user) {
        if (err) {
            console.log(err);
            req.flash("error", err.message);
            return res.redirect("/register");
        }
        await passport.authenticate("local")(req, res, function() {
            req.flash("Success", "Successfully Signed Up! Nice to meet you " + req.body.username);
            res.redirect("/blogs");
        });
    });
});

app.get("/login", function(req, res) {
    var msg = String(req.flash("error"));
    console.log(msg);
    console.log(msg.length);
    res.render("login", { msg, msg });
});

app.post("/login", passport.authenticate("local", {
    successRedirect: "/blogs",
    failureRedirect: "/login",
    failureFlash: true
}), function(req, res) {});

app.get("/logout", function(req, res) {
    req.logOut();
    req.flash("Success", "Successfully,Logged out!!")
    res.redirect("/blogs");
});

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash("error", "Please Login First!");
    res.redirect("/login");
}

async function checkBlogOwnership(req, res, next) {
    if (req.isAuthenticated()) {
        await Blog.findById(req.params.id, function(err, foundBlog) {
            if (err) {
                req.flash("error", "Something went Wrong!");
                res.redirect("back");
            } else {
                if (foundBlog.author.id.equals(req.user._id)) {
                    next();
                } else {
                    req.flash("error", "You do not have the permission!");
                    res.redirect("back");
                }
            }

        });
    } else {
        req.flash("error", "Please Login First!");
        res.redirect("/login");
    }
}

app.listen(3000, function() {
    console.log("Blog App UP!");
});