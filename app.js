const FS = require('fs');
const PATH = require('path');
const QUERYSTRING = require('querystring');
const REQUEST = require('request');

const HTTPS = require('https');
const HOSTNAME = 'xxx'; //Your hostname or server IP
const PORT = 8443; //Port NodeJS server is running on. Use either 443, 80, 88, 8443
const CERTIFICATE = FS.readFileSync('/path/to/cert');
const PRIVATEKEY = FS.readFileSync('/path/to/key');
const BOT_TOKEN = 'xxx'; //Bot token goes here.
const DEBUG_API_TOKEN ='xxx'; //Logging any errors/debug messages are passed to another bot specified by this token. If you wish to log in other way or not use it, simply delete it and any occurence of callHome()
const ADMIN_CHAT_ID = xxx; //Your personal chat id goes here.

let mainBtnA = {text:"Random 🔄",callback_data:'{"menuOpt":"randomPerson"}'};
let mainBtnB = {text:"Start Quiz 🔱",callback_data:'{"menuOpt":"startQuiz"}'};
let mainMenuKeyboard = {inline_keyboard:[[mainBtnA],[mainBtnB]]};
mainMenuKeyboard = JSON.stringify(mainMenuKeyboard);

let quizBtnA = {text:"Next Question",callback_data:'{"menuOpt":"nextQustion"}'};
let quizBtnB = {text:"Exit Quiz",callback_data:'{"menuOpt":"exitQuiz"}'};
let quizMenuKeyboard = {inline_keyboard:[[quizBtnA],[quizBtnB]]};
quizMenuKeyboard = JSON.stringify(quizMenuKeyboard);

function apiRequest(method, parameters) {

    var url = 'https://api.telegram.org/bot'+BOT_TOKEN+'/'+method+'?'+QUERYSTRING.stringify(parameters);

    var stuff = HTTPS.get(url,function (res) {
        var body = '';

        res.on('end', function () {
            var telegramJsonResponse = JSON.parse(body);
            if(telegramJsonResponse.ok == false)
                callHome("<b>Error</b> trying to execute \n\n" + url + "\n\n" + body);
            //Write error to some log file instead if you wish...
        });

        res.on('data', function (chunk) {
           body += chunk;
        });

    }).on('error', function (e) {
        callHome("<b>Error</b> trying to execute \n\n" + url + "\n\n" + body);
        console.error(e);
    });
}

function callHome(message) { //Can be used for sending out debug messages, occuring errors. This function is tied to a bot and specified chat_id
    HTTPS.get('https://api.telegram.org/bot'+DEBUG_API_TOKEN+'/sendMessage?chat_id='+ADMIN_CHAT_ID+'&parse_mode=HTML&text=' + encodeURIComponent(message));
}

function processMessage(message) {

    var userInput = message.text;
    var message_id = message.message_id;
    var chat_id = message.chat.id;

    if(userInput) {
     if(userInput == "/start") {
         apiRequest( "sendMessage", {
             parse_mode : 'HTML',
             chat_id : chat_id,
             text : "<b>Welcome to Greek Mythology Bot!</b>\n\nPress a button below or enter any name you like. I will tell you what I know abot this person. Try typing <i>Zeus</i>.",
             reply_markup : mainMenuKeyboard

        });
     }
     //else if(userInput == "???") {... }
     else {
       sendPersonData(userInput, chat_id);
     }
    }
}
function retrieveQuestion(callback) {

  //1. Build questionString
  //1.1. Retrieve random person
  REQUEST('https://anfi.tk/greekApi/person/random?lang=de', { json: true }, (err, res, body) => {

    //1.2 Build question for this person

    /*Get random number between '2' and object size (up to 10)
    This number will be used to retrieve a random field from API's json response.
    One of the following fields: mother,father,wife,husband,son,daughter,brother or sister.
    Excluded fields:
    0 -> personID
    1 -> name
    last one -> status_code
    */
    randomIntFromInterval(2,Object.keys(body).length-2, rndNum => {
         // Formulate question text
         let questionString = "Who is the " + Object.keys(body)[rndNum] + " of <b>" + body.name + "</b>?";
         let rndmField = body[Object.keys(body)[rndNum]]; //Either mother,father ... Can be an array also.
         let answers = [];
         let correctAnswer;
         if(Object.keys(body)[rndNum] == "mother" || Object.keys(body)[rndNum] == "father") { //In case of mother/father no array is returned.
            answers.push({"name":rndmField.name,"correctFlag":true,"correctAnswer":rndmField.name});
            correctAnswer = rndmField.name;
         } else { //Anything but mother/father. Array is returned. Now query a random field of that array
           randomIntFromInterval(0,rndmField.length-1, rndNum => {
             answers.push({"name":rndmField[rndNum].name,"correctFlag":true,"correctAnswer":rndmField[rndNum].name});
             correctAnswer = rndmField[rndNum].name;
           });
         }
         let apiUrl = 'https://anfi.tk/greekApi/person/random?lang=de';
         if(isMaleGender(Object.keys(body)[rndNum])) apiUrl += '&gender=male';
         else apiUrl += '&gender=female';

         //Put three other (incorrect) answers on keyboard
         for(let completedRequests = 0; completedRequests<3; completedRequests++) {
           REQUEST(apiUrl, { json: true }, (err, res, body) => {
             answers.push({"name":body.name,"correctFlag":false,"correctAnswer":correctAnswer});
             if(answers.length==4) callback(questionString, shuffle(answers));
           });
         }


     });

  });

}
function randomIntFromInterval(min, max, callback) {
    callback(Math.floor(Math.random()*(max-min+1)+min));
}
//Fisher-Yates Shuffling Algorithm (for randomly placing answers on keyboard)
function shuffle(arr) {
    var i,
        j,
        temp;
    for (i = arr.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }
    return arr;
};
function processCallbackQuery(callback_query) {
  //console.log(JSON.parse(callback_query.data).isCorrect);
  var callbackData = JSON.parse(callback_query.data);
  var callback_query_id = callback_query.id;
  let chat_id = callback_query.from.id;
  let message_id = callback_query.message.message_id

  if(callbackData.isCorrect === 'true') {
    apiRequest( "editMessageReplyMarkup", {chat_id : chat_id, message_id : message_id});
    apiRequest( "sendMessage", {
        parse_mode : 'HTML',
        chat_id : chat_id,
        text: "<b>"+callbackData.correctAnswer+"</b>\nThat's correct! ✅",
        reply_markup : quizMenuKeyboard
   });
  }
  else if(callbackData.isCorrect === 'false') {
    apiRequest( "editMessageReplyMarkup", {chat_id : chat_id, message_id : message_id});
    // let btnA = {text:"Next Question",callback_data:'{"menuOpt":"nextQustion"}'};
    // let btnB = {text:"Exit Quiz",callback_data:'{"menuOpt":"exitQuiz"}'};
    // let keyboard = {inline_keyboard:[[btnA],[btnB]]};
    // keyboard = JSON.stringify(keyboard);
    apiRequest( "sendMessage", {
        parse_mode : 'HTML',
        chat_id : chat_id,
        text : "Wrong! ❌\n\nCorrect answer:\n<b>"+callbackData.correctAnswer+"</b>",
        reply_markup : quizMenuKeyboard
    });
  }
  else if(callbackData.menuOpt === 'randomPerson') {
    apiRequest( "editMessageReplyMarkup", {chat_id : chat_id, message_id : message_id});
    REQUEST('https://anfi.tk/greekApi/person/random?lang=de', { json: true }, (err, res, body) => {
      let name = body.name
      sendPersonData(name, chat_id);
    });
  }
  else if(callbackData.menuOpt === 'startQuiz') {
    showQuestion(chat_id, message_id);

  }
  else if(callbackData.menuOpt === 'nextQustion') {
    showQuestion(chat_id,message_id);
  }
  else if(callbackData.menuOpt === 'exitQuiz') {
    apiRequest( "editMessageReplyMarkup", {chat_id : chat_id, message_id : message_id});
    apiRequest( "sendMessage", {
        parse_mode : 'HTML',
        chat_id : chat_id,
        text : "<b>Welcome to Greek Mythology Bot!</b>\n\nPress a button below or enter any name you like. I will tell you what I know abot this person. Try typing <i>Zeus</i>.",
        reply_markup : mainMenuKeyboard

   });
  }
  // switch (callbackData) {
  //
  //     // case "btnB":
  //     //     text = "button B pressed!";
  //     //     break;
  // }

  apiRequest( "answerCallbackQuery", {callback_query_id : callback_query_id});

}
function sendPersonData(userInput, chat_id) {
  //1. Retrieve all available data from api
  REQUEST('https://anfi.tk/greekApi/person/de/'+userInput, { json: true }, (err, res, body) => {
    if (err) { return console.log(err); }
    //2. Build string to send
    let resText; //Text response user receives as message
    userInput = userInput.charAt(0).toUpperCase() + userInput.slice(1);

    if(body.status != 'OK') {
      resText = "Sorry 😔. I don't know anything about<b> " + userInput + "</b> yet.";
    } else
      resText = 'Here is what I know about <b>'+userInput+'</b>:\n\n';
    if(body.father) {
      resText += 'Father 👴🏻:    <pre>' + body.father.name + "</pre>\n\n";
    }
    if(body.mother) {
      resText += 'Mother 👵🏻:    <pre>' + body.mother.name + "</pre>\n\n";
    }
    if(body.wife) {
      resText += 'Wife 👫:    <pre>';
      body.wife.forEach(function (wife, i) {
          resText += wife.name;
          if(i < body.wife.length-1) resText += ", ";
      });
      resText += '</pre>\n\n';
    }
    if(body.husband) {
      resText += 'Husband 👫:   <pre>';
      body.husband.forEach(function (husband, i) {
          resText += husband.name;
          if(i < body.husband.length-1) resText += ", ";
      });
      resText += '</pre>\n\n';
    }
    if(body.daughter) {
      resText += 'Daughter 👧🏻:    <pre>';
      body.daughter.forEach(function (daughter, i) {
          resText += daughter.name;
          if(i < body.daughter.length-1) resText += ", ";
      });
      resText += '</pre>\n\n';
    }
    if(body.son) {
      resText += 'Son 👦:    <pre>';
      body.son.forEach(function (son, i) {
          resText += son.name;
          if(i < body.son.length-1) resText += ", ";
      });
      resText += '</pre>\n\n';
    }
    if(body.brother) {
      resText += 'Brother 👱🏻:    <pre>';
      body.brother.forEach(function (brother, i) {
          resText += brother.name;
          if(i < body.brother.length-1) resText += ", ";
      });
      resText += '</pre>\n\n';
    }
    if(body.sister) {
      resText += 'Sister 👱🏻‍♀️:    <pre>';
      body.sister.forEach(function (sister, i) {
          resText += sister.name;
          if(i < body.sister.length-1) resText += ", ";
      });
      resText += '</pre>\n\n';
    }
     //3. Send message to user
     apiRequest( "sendMessage", {parse_mode : 'HTML', chat_id : chat_id, text: resText, reply_markup: mainMenuKeyboard});
  });
}
function showQuestion(chat_id, message_id) {
  retrieveQuestion((questionText, answers) => {
 //   console.log(questionText);
 //   console.log(answers);
    //Set together inline_keyboard
    let btnA = {text:answers[0].name,callback_data:'{"isCorrect":"'+answers[0].correctFlag+'","correctAnswer":"'+answers[0].correctAnswer+'"}'};
    let btnB = {text:answers[1].name,callback_data:'{"isCorrect":"'+answers[1].correctFlag+'","correctAnswer":"'+answers[1].correctAnswer+'"}'};
    let btnC = {text:answers[2].name,callback_data:'{"isCorrect":"'+answers[2].correctFlag+'","correctAnswer":"'+answers[2].correctAnswer+'"}'};
    let btnD = {text:answers[3].name,callback_data:'{"isCorrect":"'+answers[3].correctFlag+'","correctAnswer":"'+answers[3].correctAnswer+'"}'};

    let keyboard = {inline_keyboard:[[btnA,btnB],[btnC,btnD]]};
    keyboard = JSON.stringify(keyboard);

    apiRequest( "editMessageReplyMarkup", {chat_id : chat_id, message_id : message_id});
    apiRequest( "sendMessage", {
        parse_mode : 'HTML',
        chat_id : chat_id,
        text: questionText,
        reply_markup: keyboard
    });
  });
}
function isMaleGender(string) {
  let isMale= {
    "father":true, "husband":true, "son":true, "brother":true,
    "mother":false, "wife":false, "daughter":false, "sister":false
  };
  return isMale[string];
}

const server = HTTPS.createServer( {
        cert:CERTIFICATE,
        key:PRIVATEKEY
    },
function (req,res) {

  if (req.method == 'POST') { //Telegram's API will send POST requests to your server
      var body = '';

      req.on('data', function (data) {
          body += data; //Data received will be set together continuously till complete
          // Too much POST data, kill the connection!
          // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
          if (body.length > 1e6)
              req.connection.destroy();
      });

      req.on('end', function () {
          var post = JSON.parse(body);
          //console.log(post);
          if(post.hasOwnProperty('message')) //User has send a message to bot
              processMessage (post.message);
          else if(post.hasOwnProperty('callback_query')) { //User has pressed inline button
              processCallbackQuery(post.callback_query);
          }
      });
  }

  res.writeHead(200);
  res.end();

)};


server.listen(PORT, HOSTNAME, function() {
    console.log('Server started on port ' +PORT);
});
