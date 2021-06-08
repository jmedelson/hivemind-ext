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
const getDB3 = async () =>{
    const params = {
            TableName: 'hivemind-data',
            Key:{
                placeholder:"questionHolder",
                word: "placeholder"
            }
        };
    let ret = await documentClient.get(params).promise();
    return ret["Item"]["questionList"];
}
const queryDB = async (question) =>{
    let catagory = "count//"+ question;
    console.log("queryDB----", catagory);
    const params = {
        TableName: 'hivemind-data',
        IndexName: "main-index",
        KeyConditionExpression: 'placeholder = :placeholder',
        ExpressionAttributeValues: {
            ':placeholder': catagory
        },
        Limit: 8,
        ConsistentRead: false,
        ScanIndexForward: false
    }
    let ret = await documentClient.query(params).promise();
    return ret
}
const queryTotals = async(question) =>{
    console.log("queryTotals----", question);
    let catagory = "totals//"+ question;
    const params = {
        TableName: 'hivemind-data',
        KeyConditionExpression: 'placeholder = :placeholder',
        ExpressionAttributeValues: {
            ':placeholder': catagory
        },
        ConsistentRead: false,
        ScanIndexForward: false
    }
    let ret = await documentClient.query(params).promise();
    ret = ret['Items']
    console.log(ret)
    return ret
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
function dynamicSort(property) {
    return function (a,b) {
        if ( a[property] > b[property] ){
            return -1;
        }
        if ( a[property] < b[property] ){
            return 1;
        }
        if((property in a)&&!(property in b)){
            return -1;
        }
        if(!(property in a)&&(property in b)){
            return 1;
        }
        return 0;
    }
}
const mainHandler = async () => {
    let keyHold = []
    let params = {
        TableName: 'hivemind-data',
    }
    const itemsAll = await scanAll(params);
    let main = {}
    let totals = {}
    let ret = await getDB3();
    // let test = ["test q number 2"]
    for(let item of ret){
        totals = {}
        let filter = "totals//"+item
        let filtered = itemsAll.filter(function(el){
            return el["placeholder"] == filter
        })
        // console.log(filtered)
        for(let element of filtered){
            totals[element.word] = element.count
        }
        let tempHold = []
        for(let key in totals){
            if(!(key in keyDict)){
                keyHold.push(key)
            }
            let filter2 = "channel//"+key
            itemsAll.sort(dynamicSort(filter2))
            let focus = itemsAll[0]
            // console.log("FOCUS", focus)
            if(!(item in main)){
                main[item] = {}
            }
            tempHold.push({
                channel:key,
                word: focus["word"],
                percent: parseInt(focus[filter2])/parseInt(totals[key])
            })
        }
        if(tempHold.length>0){
            main[item] = tempHold
        }
    }
    // console.log("keyDict", keyDict)
    // console.log("keyHold", keyHold)
    if(keyHold.length>0){
        const oauth = await requestOauth();
        keyHold = [...new Set(keyHold)]
        let names = await getUserNames(oauth, keyHold)
        // console.log("NAMES", names)
        for(let item of names){
            let id = parseInt(item.id)
            keyDict[id] = item.display_name
        } 
    }
    for(let key in main){
        let x = main[key]
        for(let entry of x){
            entry.channel = keyDict[entry.channel]
        }
    }
    console.log(main)
    console.log("keyDict", keyDict)
    let final = {
        questions:main
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