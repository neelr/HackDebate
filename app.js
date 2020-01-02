require("dotenv").config();
var express = require("express");
var axios = require("axios");
var airtable = require("airtable");
const path = require('path');
const qs = require("qs");
var cookieParser = require('cookie-parser')
var base = new airtable({apiKey:process.env.AIRTABLE_KEY}).base(process.env.AIRTABLE_BASE);
var app = express();


var slack = (user,text,ts) => {
	return new Promise((res,rej) => {
		axios.post("https://slack.com/api/chat.postMessage",qs.stringify({"token":process.env.OAUTH,"channel":user,"text":text,"thread_ts":ts}))
		.then((data) => {
        res(data.data);
      })
	})
}
app.set('view engine', 'ejs');
var redirect_uri = "http://localhost:3000/slack/auth"
if (process.env.PROD == "production") {
    redirect_uri = "https://hackdebate.now.sh/slack/auth"
}
app.set('views', path.join(__dirname, 'views/'));
app.use(cookieParser())
app.use(express.json());
app.get("/" ,(req,res) => {
    var user = {key:""};
    if (req.cookies.user) {
        user = JSON.parse(req.cookies.user);
    }
    if (user.key != "") {
        res.redirect("/home");
    } else {
        res.render("index", {url:redirect_uri});
    }
});
app.get("/slack/auth" , (req,res) => {
    done = false;
    axios.get("https://slack.com/api/oauth.access?client_id=2210535565.869749243826&redirect_uri="+redirect_uri+"&client_secret="+process.env.CLIENT_SECRET+"&code="+req.query.code)
        .then((data) => {
            var user = data.data.user
            base("Forms").select({
                view: "Main",
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
                    ], () => {
                        res.cookie("user",JSON.stringify(user));
                        res.redirect("/home");
                    })
                })
                next();
            },() => {
                if (!done) {
                    console.log("here")
                    user.key = JSON.stringify((Math.random()%3131134512)*13344);
                    base('Forms').create([
                        {
                            "fields": {
                                "Name": user.name,
                                "Slack ID": user.id,
                                "Email":user.email,
                                "Key":user.key
                            }
                        }
                    ],(err) => {
                        console.log(err)
                        res.cookie("user",JSON.stringify(user));
                        res.redirect("/home");
                    })
                }
            })
        })
});
app.get("/home" , (req,res) => {
    var done = false;
    var user = JSON.parse(req.cookies.user)
    user.id = user ? user.id : "none";
    base("Forms").select({
        view: "Main",
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
            res.cookie("user","");
            res.redirect("/")
        }
    })
});
app.post("/sendmail", (req,res) => {
    if (req.body.key == process.env.KEY) {
        base("Forms").select({
            view:"Main"
        }).eachPage((records,next) => {
            records.forEach(async (record) => {
                console.log(record.get("Slack ID"))
                slack(record.get("Slack ID"),req.body.text);
            });
            next();
        }, () => {
            res.send(200);
        });
    }
})
app.post("/delete", (req,res) => {
    base("Forms").select({
        view:"Main"
    }).eachPage((records,next) => {
        records.forEach(async (record) => {
            if (record.get("Key") == req.body.key) {
                base("Forms").destroy([record.id],() => {
                    res.send({"ok":true})
                });
            }
        });
        next();
    });
})
app.listen(3000, () => console.log("Listening on port 3000"));