const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-east-2' });
const jwt = require('jsonwebtoken');
const axios = require('axios');

let keyDict = {
    0:"Unknown"
}
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
const scanAll = async (params) => {
  let lastEvaluatedKey = 'dummy'; // string must not be empty
  const itemsAll = [];
  while (lastEvaluatedKey) {
    const data = await documentClient.scan(params).promise();
    itemsAll.push(...data.Items);
    lastEvaluatedKey = data.LastEvaluatedKey;
    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }
  }
  return itemsAll;
}

const getData = async () => {
    let params = {
        TableName: 'hivemind-streamer',
    }
    const itemsAll = await scanAll(params);
    return itemsAll
}
const mainHandler = async () => {
    let final = {
        questions:[]
    }
    let ids = []
    let data = await getData()
    // console.log(data)
    for(let question of data){
        // console.log(Object.keys(question))
        let keys = Object.keys(question)
        for(let key of keys){
            if(key.startsWith("channel")){
                var channel = key.substring(7,key.length)
                if(channel in keyDict){
                    // console.log(channel)
                }else{
                    ids.push(channel)
                }
            }
        }
        console.log(ids)
    }
    if(ids.length>0){
        const oauth = await requestOauth();
        ids = [...new Set(ids)] // removes duplicates
        let names = await getUserNames(oauth, ids)
        // console.log("NAMES", names)
        for(let item of names){
            let id = parseInt(item.id)
            keyDict[id] = item.display_name
        } 
        // console.log(keyDict)
    }
    for(let question of data){
        let item = {}
        let keys = Object.keys(question)
        for(let key of keys){
            if(key.startsWith("channel")){
                var channel = key.substring(7,key.length)
                if(channel in keyDict){
                    let name = keyDict[channel]
                    item[name] = question[key]
                }
            }
            if(key == 'total'){
                item['total'] = question['total']
            }
        }
        console.log(item)
        let item2 = {}
        item2[question['question']] = item
        final['questions'].push(item2)
    }
    
    
    return final
}

exports.handler = async (event) => {
    // TODO implement
    let ret = await mainHandler();
    console.log("EVENT",event)
    const response = {
        statusCode: 200,
        body: JSON.stringify(ret),
        headers:{"content-type": "application/json"}
    };
    return response;
};