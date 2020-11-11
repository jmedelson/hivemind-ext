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
const updateScene = async (scene) =>{
    console.log("Update scene to:", scene);
    const params = {
        TableName: 'hivemind',
        Key:{
            "catagory": "scene",
            "sort": "placeholder"
        },
        UpdateExpression: "SET scene =:a",
        ExpressionAttributeValues:{
            ":a":scene,
        },
        ReturnValues:"UPDATED_NEW"
    };
    return await documentClient.update(params).promise();
}


const mainHandler = async(parsed, event) =>{
    console.log("mainHandler started",parsed['flag'])
    if(parsed['flag']=="scene"){
        console.log("flag = scene")
        let payload = parsed['payload'];
        console.log("PAYLOAD:", payload);
        var message = {
            data:{
              identifier:'scene',
              payload:payload
            }
        }
        let [scene, broadcastResult] = await Promise.all([updateScene(payload),sendBroadcast('21314155', JSON.stringify(message))]);
        console.log("SCENE:",scene)
        console.log("Broadcast complete")
        return(payload)
    }else if(parsed['flag']=="scene"){
        console.log("hello world")
    }
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
    console.log("EVENT",event['body'])
    let parsed = JSON.parse(event['body'])
    let ret = await mainHandler(parsed, event)
    // console.log("EVENT: ", event['pathParameters'], "LENGTH:", event['pathParameters'].length>0)
    // TODO implement
    
    var x = {
        data:{
            id:"loaded from AWS",
            message:"HELLO WORLD"
        }
    }
    var body= JSON.stringify(x)
    var statusCode = 200
    return { statusCode, body: JSON.stringify(body, null, 2), headers };
};
