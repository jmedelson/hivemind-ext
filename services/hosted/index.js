const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-east-2' });
const jwt = require('jsonwebtoken');
const axios = require('axios');

const verifyAndDecode = (auth) => {
    const bearerPrefix = 'Bearer ';
    if (!auth.startsWith(bearerPrefix)) return { err: 'Invalid authorization header' };
    try {
      const token = auth.substring(bearerPrefix.length);
      const secret = process.env.secret;
      return jwt.verify(token, Buffer.from(secret, 'base64'), { algorithms: ['HS256'] });
    } catch (err) {
      return { err: 'Invalid JWT' };
    }
};
const makeServerToken = channelID => {
    const serverTokenDurationSec = 30;
  
    const payload = {
      exp: Math.floor(Date.now() / 1000) + serverTokenDurationSec,
      channel_id: "all",
      user_id: process.env.ownerId,
      role: 'external',
      pubsub_perms: {
        send: ["global"],
      },
    };
    
    const secret = Buffer.from(process.env.secret, 'base64');
    return jwt.sign(payload, secret, { algorithm: 'HS256' });
};

const sendBroadcast = async (channel, data) =>{
    console.log("Sending broadcast", channel, data)
    // const link = `https://api.twitch.tv/extensions/message/` + channel
    const link = "https://api.twitch.tv/extensions/message/all"
    const bearerPrefix = 'Bearer ';
    const request = {
        method: 'POST',
        url: link,
        headers : {
            'Client-ID': process.env.clientId,
            'Content-Type': 'application/json',
            'Authorization': bearerPrefix + makeServerToken(channel),
        },
        data : JSON.stringify({
          content_type: 'application/json',
          message: data,
          targets: ['global']
        })
    }
    return await axios(request)
}
const getDB = async () =>{
    const params = {
            TableName: 'hivemind-ext',
            Key:{
                data:"data"
            },
            AttributesToGet: [
                'scene',
                'answer',
                'question',
                'correct'
            ]
        };
    let ret = await documentClient.get(params).promise();
    return ret;
}
const updateDB = async (type,data) =>{
    console.log("Update "+ type +" to:", data);
    const params = {
        TableName: 'hivemind-ext',
        Key:{
            data:"data"
        },
        UpdateExpression: "SET #catagory =:a",
        ExpressionAttributeNames:{
            "#catagory": type
        },
        ExpressionAttributeValues:{
            ":a":data,
        },
        ReturnValues:"UPDATED_NEW"
    };
    return await documentClient.update(params).promise();
}

const updateDB2 = async (word) =>{
    console.log("Updatedb2: "+ word);
    const params = {
        TableName: 'hivemind-data',
        Key: {
            "placeholder": "placeholder",
            "word": word
        },
        UpdateExpression: 'ADD #a :y',
        ExpressionAttributeNames: {'#a' : 'count'},
        ExpressionAttributeValues: {
            ':y' : 1
        },
        ReturnValues: "UPDATED_NEW"
    };
    return await documentClient.update(params).promise();
}

const queryDB = async (placeholder) =>{
    console.log("queryDB----", placeholder);
    const params = {
        TableName: 'hivemind-data',
        IndexName: "main-index",
        KeyConditionExpression: 'placeholder = :placeholder',
        ExpressionAttributeValues: {
            ':placeholder': placeholder
        },
        ConsistentRead: false,
        ScanIndexForward: false
    }
    return await documentClient.query(params).promise();
}
const queryDB2 = async (placeholder) =>{
    console.log("queryDB2----", placeholder);
    const params = {
        TableName: 'hivemind-data',
        KeyConditionExpression: 'placeholder = :placeholder',
        ExpressionAttributeValues: {
            ':placeholder': placeholder
        },
        ConsistentRead: false,
        ScanIndexForward: false
    }
    return await documentClient.query(params).promise();
}

const voteDB = async (data) =>{
    console.log("voteDB: "+ data);
    let channel = data['channel']
    let vote
    if(data['payload']){
        vote = "agree"
    }else{
        vote = "disagree"
    }
    let question2 = data['question']
    console.log('question2.....',question2,vote,channel)
    let answer = data['answer']
    let sortK = channel+'//'+answer
    let params = {
        TableName: 'hivemind-data',
        Key:{
            "placeholder": question2,
            "word": sortK
        },
        UpdateExpression: 'ADD #a :y',
        ExpressionAttributeNames:{
            "#a": vote,
            // "#b": 'count'
        },
        ExpressionAttributeValues:{
            ":y":1,
        },
        ReturnValues:"NONE"
    };
    let updated = await documentClient.update(params).promise();
    return updated;
}
const addQuestion = async (question,getOnly = false) =>{
    //dynamo db entry must be created by hand for list
    
    console.log("addQuestion: "+ question);
    let params = {
        TableName: 'hivemind-data',
        Key:{
            "placeholder": "questionHolder",
            "word": "placeholder"
        },
        AttributesToGet: [
            'questionList'
        ]
    }
    let questionList = await documentClient.get(params).promise();
    // console.log("CHECK!!!!= ", getOnly, questionList)
    if(getOnly){
        console.log("getOnly======",questionList)
        return questionList['Item']['questionList']
    }
    console.log("questionList:", questionList)
    console.log("Is question in list: ", questionList['Item']['questionList'].includes(question))
    if(questionList['Item']['questionList'].includes(question)){
       console.log("question already in Database") 
    }
    else{
        let params2 = {
            TableName: 'hivemind-data',
            Key:{
                "placeholder": "questionHolder",
                "word": "placeholder"
            },
            UpdateExpression: 'SET #a = list_append(#a, :vals)',
            ExpressionAttributeNames:{
                "#a": "questionList",
            },
            ExpressionAttributeValues:{
                ":vals": [question],
            },
            ReturnValues:"NONE"
        };
        let updated = await documentClient.update(params2).promise(); 
    }
    
}
const scanDB = async () =>{
    console.log("scanDB----");
    const params = {
        TableName: 'hivemind-response',
        IndexName: "word-index",
        ConsistentRead: false
    }
    let scanned = await documentClient.scan(params).promise();
    let hold = []
    let items = scanned.Items
    console.log("ITEMS SCANNED:",items.length)
    items.forEach(function(obj,i){
        console.log(i);
        console.log(obj);
        var params = {
            TableName: 'hivemind-response',
            ReturnValues: 'NONE',
            ReturnConsumedCapacity: 'NONE',
            ReturnItemCollectionMetrics: 'NONE'
        }
        documentClient.delete(params, function(err,data){
            if(err){
                console.log(err)
            }
        })
    })
    console.log("DONE")
    return("DONE")
}
const resetDB = async () =>{
    console.log("resetDB----");
    let params = {
        TableName: 'hivemind-data',
    }
    let scanned = await documentClient.scan(params).promise();
    let hold = []
    let items = scanned.Items
    console.log("ITEMS SCANNED:",items.length, items)
    let x = await Promise.all(items.map(async(item)=>{
        console.log(item.word)
        let params = {
            TableName: 'hivemind-data',
            Key:{
                "placeholder":"placeholder",
                "word":item.word
            }
        }
        await documentClient.delete(params, function(err,data){
            if (err) {
                console.error("Unable to delete item. Error JSON:", JSON.stringify(err, null, 2));
            } else {
                console.log("DeleteItem succeeded:", JSON.stringify(data, null, 2));
            }
        }).promise()
    }))
    let params2 = {
        TableName: 'hivemind-ext',
        Key:{
            data:"data"
        },
        UpdateExpression: "SET #a =:a,#b = :b,#c=:c, #d=:d",
        ExpressionAttributeNames:{
            "#a": "scene",
            "#b": "answer",
            "#c": "question",
            "#d": "correct"
        },
        ExpressionAttributeValues:{
            ":a":"wait",
            ":b":"???",
            ":c": " ",
            ":d":"unset"
        },
        ReturnValues:"UPDATED_NEW"
    };
    let updated = await documentClient.update(params2).promise();
    console.log("DONE!!!!!", updated)
    return("DONE")
}

const mainHandler = async(parsed, event) =>{
    if(parsed != null){
        console.log("mainHandler started",parsed['flag'],parsed['flag']=="SET")
        if(parsed['flag']=="SET"){
            console.log("flag = SET")
            let payload = parsed['payload'];
            let catagory = parsed['catagory'];
            let message = {
                data:{
                  identifier: catagory,
                  payload:payload
                }
            }
            if(catagory=="correct"){
                let catagory2 = "scene"
                let payload2 = "result"
                let [updated, ignore, broadcastResult] = await Promise.all([updateDB(catagory, payload),updateDB(catagory2, payload2),sendBroadcast(process.env.ownerId, JSON.stringify(message))]);
            }else if(catagory=='question'){
                let [updated, ignore, broadcastResult] = await Promise.all([updateDB(catagory, payload),addQuestion(payload),sendBroadcast(process.env.ownerId, JSON.stringify(message))]);
            }else if(catagory=="answer"){
                let catagory2 = "correct"
                let payload2 = "unset"
                let [updated, ignore, broadcastResult] = await Promise.all([updateDB(catagory, payload),updateDB(catagory2, payload2),sendBroadcast(process.env.ownerId, JSON.stringify(message))]);
            } else {
                let [updated, broadcastResult] = await Promise.all([updateDB(catagory, payload),sendBroadcast(String(process.env.ownerId), JSON.stringify(message))]);
            }
            let ret = {
                id:catagory,
                data: payload
            }
            return(ret)
        }else if(parsed['flag']=="poll-ans"){
            console.log("flag = poll-ans")
            let payload = parsed['payload'];
            let broadcastResult = await updateDB2(payload)
            let ret = {
                id: "poll-response",
                data: payload
            }
            return(ret)
        }else if(parsed['flag']=="vote"){
            await voteDB(parsed)
        }else if(parsed['flag']=="getResponses"){
            let results = await queryDB("placeholder")
            console.log("RESPONSE", results)
            let ret = {
                id:"POLL-results",
                data: results
            }
            return(ret)
        }else if(parsed['flag']=="sendReset"){
            let results = await resetDB()
            console.log("RESET RESPONSE", results)
            let ret = {
                id:"reset-results",
                data: results
            }
            return(ret)
        }else if(parsed['flag']=='question-data'){
            let results = await addQuestion("no question",true)
            let ret = {
                id:"question-data",
                data: results
            }
            return(ret)
        }else if(parsed['flag']=='answer-data'){
            let results = await queryDB2(parsed['payload'])
            let ret = {
                id:"answer-data",
                data: results
            }
            return(ret)
        }
    }else if(event['httpMethod']=="GET"){
        console.log("GET received")
        
        let ret = await getDB()
        console.log(ret)
        let message = {
          id:"data",
          data:{
            scene : ret['Item']['scene'],
            question : ret['Item']['question'],
            answer : ret['Item']['answer'],
            correct: ret['Item']['correct']
          }
        }
        console.log("M",message)
        return(message)
    }else{
        let message = {
          id:"unknown",
          data: ""
        }
        return(message)
    }
    let message = {
        id:"unknown",
        data: ""
    }
    return(message)
}

exports.handler = async (event) => {
    const headers = {
        // ['Access-Control-Allow-Origin']: event.headers.origin,
        ['Access-Control-Allow-Origin']: '*',
        ["Access-Control-Allow-Credentials"] : true,
        ['Access-Control-Allow-Methods']: "PUT, GET, POST, DELETE, OPTIONS",
        ["Access-Control-Allow-Headers"]:  "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With"
    };
    // if(event['httpMethod'] == 'OPTIONS'){
    //     return { statusCode:200, body: "sucess", headers };
    // }
    console.log("EVENT",event)
    let parsed = JSON.parse(event['body'])
    let ret = await mainHandler(parsed, event)
    // console.log("EVENT: ", event['pathParameters'], "LENGTH:", event['pathParameters'].length>0)
    // TODO implement
    
    var x = {
        id:ret.id,
        message:ret.data
    }
    var body= JSON.stringify(x)
    console.log("b",body)
    var statusCode = 200
    return { statusCode, body: JSON.stringify(body, null, 2), headers };
};
