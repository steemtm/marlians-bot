const steem = require('steem')
const colors = require('colors')
const config = require('./config.json')
const fs = require("fs")
const comments = {
	"success" : fs.readFileSync("./comments/success.md", "utf-8"),
	"call_under_comment" : fs.readFileSync("./comments/call_under_comment.md", "utf-8"),
	"limit_reached" : fs.readFileSync("./comments/limit_reached.md", "utf-8"),
	"not_allowed" : fs.readFileSync("./comments/not_allowed.md", "utf-8"),
	"cat_not_allowed" : fs.readFileSync("./comments/cat_not_allowed.md", "utf-8")
}
var db = JSON.parse(fs.readFileSync("./database/log.json", "utf-8"))
var day, last_call, check_it = true

console.log('\033[2J')
console.log("#----------------------------#".green)
console.log("#        MARLIANS-BOT        #".green)
console.log("#----------------------------#".green)
console.log("")

function doesContainPhrase (operationData) {
	var body = operationData.body
	for (var i = 0; i <= config.call_phrases.length - 1; i++) {
		if (body.includes(config.call_phrases[i])) {
			return true
		}
	}
	return false
}

function getCallData(operationData, callback) {
	var backData = {
		"allowed" : false,
		"categoryAllowed" : false,
		"callsFromThisUser" : 0,
		"call_under_comment" : false
	}
	var callsFromThisUser = 0
	for(call_no in db.days[day].calls)
	{
		if (db.days[day].calls[call_no].caller == operationData.author) {
			callsFromThisUser++
		}
	}
	backData.callsFromThisUser = callsFromThisUser
	var userList = fs.readFileSync("./users/allowed_users.txt", "utf-8")
	if (userList.includes(operationData.author)) {		
		steem.api.getContent(operationData.author, operationData.permlink, function(err, result) {
			if (!err) {
				if (result.depth > 1) {
					backData.call_under_comment = true
				}
				var ARR = userList.split('\n')
				for (data_num in ARR) {
					var this_user = ARR[data_num].split(' ')
					if (this_user[0] == operationData.author) {
						backData.allowed = true
						for (var x = 1; x <= this_user.length - 1; x++)
						{
							if (this_user[x] == result.category) {
								backData.categoryAllowed = true
							}
						}
					}
				}
				callback(backData)
			}
			else {
				console.log("ERR".bgRed, "Knowing it is under a comment or not".yellow)
			}
		})
	}
	else {
		callback(backData)
	}
}

function checkEligibility (operationData, callback) {
	getCallData(operationData, function (result_data) {
		if(result_data.allowed == false) {
			callback("not_allowed")
		}
		else if (result_data.categoryAllowed == false) {
			callback("cat_not_allowed")
		}
		else if (result_data.call_under_comment == true)	{
			callback("call_under_comment")
		}
		else if (result_data.callsFromThisUser >= config.user_limits.calls_per_day)	{
			callback("limit_reached")
		}
		else
			callback("eligible")
	})
}

function votePost (operationData, weight, callback) {	
	steem.broadcast.vote(config.keys.posting, config.username, operationData.author, operationData.permlink, weight, function(err, result) {
		if (!err) {
			console.log("SUCCESSFULLY VOTED ON POST".green)
			callback(true)
		}
		else {
			console.log("ERR".bgRed, "While Voting, Skipped this Call".yellow)
			callback(false)
		}
	})
}

function comment (type, operationData, weight, callback) {
	var commentPermlink = steem.formatter.commentPermlink(operationData.parent_author, operationData.parent_permlink)
	var body = comments[type].replace(/%author%/gi, operationData.parent_author)
	body = body.replace(/%caller%/gi, operationData.author)
	body = body.replace(/%vote_weight%/gi, weight)
	jsonMetadata = 	{"tags":["marlians"],"app":"marlians-bot\/1.0","format":"markdown", "app_dev" : "Ali H"}
	steem.broadcast.comment(
		config.keys.posting, 
		operationData.parent_author, 
		operationData.parent_permlink, 
		config.username, commentPermlink, 
		"", 
		body, 
		jsonMetadata, 
		function(err, result) {
		if (!err) {
			console.log("SUCCESSFULLY COMMENTED ON POST".green)
			callback()
		}
		else {
			console.log("ERR".bgRed, "While Commenting".yellow)
			callback()
		}
	})
}

function updateDatabase (operationData, weight) {
	var this_call_id = last_call++
	var this_data = {
		"caller" : operationData.author,
		"author" : operationData.parent_author,
		"vote_weight" : weight / 100
	}
	db.days[day].calls[this_call_id] = this_data
	fs.writeFile("./database/log.json", JSON.stringify(db, null, "\t"), function(err) {
	    if(err) {
		return console.log(err);
	    }
		console.log("DATABASE UPDATED".green);
		console.log("")
	})
}

function updateDay () {
	check_it == false
	db.days[++day] = {
		"calls" : {}
	}
	fs.writeFile("./database/log.json", JSON.stringify(db, null, "\t"), function(err) {
	    if(err) {
		return console.log(err);
	    }
		console.log("DAY REST! DB UPDATED".green);
		console.log("")
		check_it == true
	})
}

if (config.isset == false) {
	console.log(" ERR ".bgRed, "Please Configure the bot first, edit config.json file".yellow)
}
else {
	console.log("BOT STARTED".yellow)
	var check = 0
	steem.api.streamOperations(function (err, result) {
		if (check_it == true) {
			if (check == 0) {
				console.log("STREAMING MARLIANS STARTED..".yellow)
				console.log("")
				check++
			}
			if (new Date().getHours() == 00 && new Date().getMinutes() == 00) {
				updateDay()
			}
			var operationType = result[0]
			var operationData = result[1]
			if (operationType == "comment" && doesContainPhrase(operationData)) {
				db = JSON.parse(fs.readFileSync("./database/log.json", "utf-8"))
				day = Object.keys(db.days).length
				last_call = Object.keys(db.days[day].calls).length
				console.log(" => ".bgRed," NEW COMMENT FOUND".yellow)
				console.log("PROCEEDING NOW...".yellow)
				checkEligibility(operationData, function(result) {
					if (result == "eligible") {
						var start_location, weight
						for (var i = 0; i <= config.call_phrases.length - 1; i++) {
							if (operationData.body.includes(config.call_phrases[i])) {
								start_location = operationData.body.search(config.call_phrases[i])
							}
						}
						var textRaw = operationData.body.substr(start_location)
						var text = textRaw.split(" ")
						if (typeof text[1] != "undefined" && parseInt(text[1]) <= 100) {
							weight = parseInt(text[1]) * 100
						}
						else
							weight = config.def_vote_percent * 100
						votePost(operationData, weight, function (log) {
							if (log == true)
							comment("success", operationData, weight, function () {
								updateDatabase(operationData, weight)
							})
						})
					}
					else {
						comment(result, operationData, 0, function() {})
						console.log("USER IS NOT ELIGIBLE REASON => ".yellow, result.green)
					}
				})
			}
		}
	})
}
