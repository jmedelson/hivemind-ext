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
    const serverTokenDurationSec = 60;
  
    const payload = {
      exp: Math.floor(Date.now() / 1000) + serverTokenDurationSec,
      channel_id: channelID,
      user_id: process.env.ownerId,
      role: 'external',
      pubsub_perms: {
        send: ["broadcast"],
      },
    };
    
    const secret = Buffer.from(process.env.secret, 'base64');
    return jwt.sign(payload, secret, { algorithm: 'HS256' });
};

const sendBroadcast = async (channel, data) =>{
    console.log("Sending broadcast", channel, data)
    const link = `https://api.twitch.tv/extensions/message/` + channel
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
          targets: ['broadcast']
        })
    }
    return await axios(request)
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

const queryDB = async () =>{
    console.log("queryDB----");
    const params = {
        TableName: 'hivemind-data',
        IndexName: "main-index",
        KeyConditionExpression: 'placeholder = :placeholder',
        ExpressionAttributeValues: {
            ':placeholder': "placeholder"
        },
        ConsistentRead: false,
        ScanIndexForward: false
    }
    return await documentClient.query(params).promise();
}
const scanDB = async () =>{
    console.log("scanDB----");
    const params = {
        TableName: 'hivemind-response',
        IndexName: "word-index",
        ConsistentRead: false
    }
    return await documentClient.scan(params).promise();
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
            let [updated, broadcastResult] = await Promise.all([updateDB(catagory, payload),sendBroadcast('21314155', JSON.stringify(message))]);
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
        }else if(parsed['flag']=="getResponses"){
            let results = await queryDB()
            console.log("RESPONSE", results)
            let ret = {
                id:"POLL-results",
                data: results
            }
            return(ret)
        }
    }else if(event['httpMethod']=="GET"){
        console.log("GET received")
        const params = {
            TableName: 'hivemind-ext',
            Key:{
                data:"data"
            },
            AttributesToGet: [
                'scene',
                'answer',
                'question'
            ]
        };
        let ret = await documentClient.get(params).promise();
        console.log(ret)
        let message = {
          id:"data",
          data:{
            scene : ret['Item']['scene'],
            question : ret['Item']['question'],
            answer : ret['Item']['answer']
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
