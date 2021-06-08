const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-east-2' });
const jwt = require('jsonwebtoken');
const axios = require('axios');

let channelDict = {0:"Total"}
const requestOauth = async () => {
    const link = "https://id.twitch.tv/oauth2/token?client_id=" + "552mdyt25wnm6v5oqddfk7102clylf" + "&client_secret=" + "honubqy3o1jpu30rrbkgqotfg08m2m" + "&grant_type=client_credentials";
    try {
        const response = await axios.post(link);
        // console.log(response.data, link);
        // console.log(response.data.explanation);
        return response.data.access_token;
    } catch (error) {
        console.log(error, link);
        return false;
    }
    
}
const getUserNames = async (oauth, ids) => {
    console.log("recieved oauth", oauth)
    console.log("recieved #ids:", ids)
    let search = ""
    for(let item of ids){
        search = search + item + "&id="
    }
    search = search.slice(0,-4)
    const link = "https://api.twitch.tv/helix/users?id=" + search
    let res = await axios.get(link,{
        headers:{
            'Authorization': 'Bearer ' + oauth,
            'Client-ID' : "552mdyt25wnm6v5oqddfk7102clylf"
        }
    })
    // console.log("RES===", res)
    // console.log("DATA!!:", res.data.data)
    return res.data.data
}
const mainHandler = async () => {
    console.log("main")
    const params = {
        TableName: 'hivemind-votes',
        ConsistentRead: false
    }
    let scanned = await documentClient.scan(params).promise();
    console.log("scanned")
    scanned = scanned["Items"]
    let hold = []
    for(let item of scanned){
        if(!(item.channel in channelDict)){
        //   console.log(item.channel)
            hold.push(item.channel)
        }
    }
    console.log("looped")
    if(hold.length>0){
        // console.log("HOLD", hold)
        hold = [...new Set(hold)]
        // console.log("HOLD", hold)
        const oauth = await requestOauth();
        // console.log("oauth",oauth)
        let names = await getUserNames(oauth, hold)
        for(let item of names){
            let id = parseInt(item.id)
            channelDict[id] = item.display_name
        }
    }
    console.log("api call finished")
    
    let res = []
    for(let item of scanned){
        res.push({
            question:item.question,
            disagree:item.disagree,
            agree: item.agree,
            channel: channelDict[item.channel]
        })
    }
    return res
}

exports.handler = async (event) => {
    // TODO implement
    let ret = await mainHandler();
    const response = {
        statusCode: 200,
        body: JSON.stringify(ret),
        headers:{"content-type": "application/json"}
    };
    return response;
};