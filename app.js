const steem = require('steem')
const colors = require('colors')
const config = require('./config.json')
const fs = require("fs")
const comments = {
	// "success" : fs.readFileSync("./comments/success.md", "utf-8")
}

// var db = JSON.parse(fs.readFileSync("./database/log.json", "utf-8"))


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

function checkEligibility (operationData, callback) {
	callsFromThisUser = 0
	for(call_no in db.days[day].calls)
	{
		if (db.days[day].calls[call_no].caller == operationData.author) {
			callsFromThisUser++
		}
	}

	if(result_data.allowed == false) {
		callback("not_allowed")
	}
	else if (result_data.categoryAllowed == false) {
		callback("cat_not_allowed")
	}
	else if (callsFromThisUser >= config.user.calls_per_day)
	{
		callback("limit_reached")
	}
}

if (config.isset == false) {
	console.log(" ERR ".bgRed, "Please Configure the bot first, edit config.json file".yellow)
}
else {
	console.log("BOT STARTED".yellow)
	var check = 0
	steem.api.streamOperations(function (err, result) {
        if (check == 0) {
            console.log("STREAMING MARLIANS STARTED..".yellow)
            console.log("")
            check++
        }
        var operationType = result[0]
        var operationData = result[1]
        if (operationType == "comment" && doesContainPhrase(operationData))
        {
            console.log(" => ".bgRed," NEW COMMENT FOUND")
            console.log("PROCEEDING NOW...")
            checkEligibility(operationData, function(result) {

            })
        }
	})
}