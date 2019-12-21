require("dotenv").config();
var express = require("express");
var axios = require("axios");
var airtable = require("airtable");
var fs = require('fs');
const path = require('path');
var cookieParser = require('cookie-parser')
var base = new airtable({apiKey:process.env.AIRTABLE_KEY}).base(process.env.AIRTABLE_BASE);
var app = express();
app.set('view engine', 'ejs');
var redirect_uri = "http://hackdebate.now.sh/slack/auth"

app.use(express.static(path.join(__dirname, 'views')));
app.use(cookieParser())
app.get("/" ,(req,res) => {
    res.send("index");
});
app.get("/slack/auth" , (req,res) => {
    console.log(req.query)
    done = false;
    axios.get("https://slack.com/api/oauth.access?client_id=2210535565.869749243826&redirect_uri="+redirect_uri+"&client_secret="+process.env.CLIENT_SECRET+"&code="+req.query.code)
        .then((data) => {
            var user = data.data.user
            user.data = user ? user.data : "none";
            console.log(data.data)
            base("Forms").select({
                view: "Grid view",
                filterByFormula:"{Slack ID} = '"+user.id+"'"
            }).eachPage((records,next) => {
                records.forEach((record) => {
                    done = true;
                    user.key = JSON.stringify((Math.random()%3131134512)*13344);
                    base("Forms").update([
                        {
                            "id":record.id,
                            "fields": {
                                "Email":user.email,
                                "Key":user.key
                            }
                        }
                    ])
                    res.cookie("user",JSON.stringify(user));
                    res.redirect("/home");
                    user.completed = true;
                })
                next();
            },() => {
                if (!done) {
                    res.redirect("https://airtable.com/shrT7JvB9KUiD3YX1")
                }
            })
        })
});
app.get("/home" , (req,res) => {
    var done = false;
    var user = JSON.parse(req.cookies.user)
    user.id = user ? user.id : "none";
    base("Forms").select({
        view: "Grid view",
        filterByFormula:"{Slack ID} = '"+user.id+"'"
    }).eachPage((records,next) => {
        records.forEach((record) => {
            if (record.get("Key") == user.key) {
                done = true
                res.render("userpage",{"record":record})
            }
        })
        next();
    },() => {
        if (!done) {
            res.redirect("/")
        }
    })
});

app.listen(3000, () => console.log("Listening on port 3000"));