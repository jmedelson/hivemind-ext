const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-east-2' });

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
    ret = ret["Items"]
    let res = {
        answers:{
            
        }
    }
    for(let item of ret){
    res['answers'][item.word] = item.count 
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
    let ret = await getDB3();
    let items = ret.map(async (item) => {
        let hold = await queryDB(item);
        let data = {
            question:item,
            ...hold
        }
        return data
    })
    let resAll = await Promise.all(items)
    let main = {
        count:resAll
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
