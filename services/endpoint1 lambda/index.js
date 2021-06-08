const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-east-2' });

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
                'correct',
                'limit',
                'displayLimit',
                'displayQuestion'
            ]
        };
    let ret = await documentClient.get(params).promise();
    return ret["Item"];
}
const getDB2 = async () =>{
    const params = {
            TableName: 'hivemind-ext',
            Key:{
                data:"controlpanel"
            }
        };
    let ret = await documentClient.get(params).promise();
    return ret["Item"];
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
        Limit: 10,
        ConsistentRead: false,
        ScanIndexForward: false
    }
    let ret = await documentClient.query(params).promise();
    ret = ret["Items"]
    let res = {
        pollResponses:{
            
        }
    }
    for(let item of ret){
    res['pollResponses'][item.word] = item.count 
    }
    return res
}
const scanDB = async() => {
    var params1 = {
        TableName: "hivemind-data"
    }
    let ret = await documentClient.scan(params1).promise();
    return ret;
}


const mainHandler = async () => {
    let [ret,ret2,ret3] = await Promise.all([getDB(),getDB2(),scanDB()]);
    // let [ret] = await Promise.all([getDB2()]);
    // let ret3 = await queryDB(ret.displayQuestion)
    // let ret3 = await scanDB()
    let main = {
        ...ret,
        ...ret2,
        ...ret3
    }
    return main
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
