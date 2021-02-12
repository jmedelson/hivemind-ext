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
                'correct',
                'limit',
                'displayLimit',
                'displayQuestion'
            ]
        };
    let ret = await documentClient.get(params).promise();
    return ret;
}
const getDB2 = async () =>{
    const params = {
        TableName: 'hivemind-ext',
        Key:{
            data:"controlpanel"
        }
    };
    let ret = await documentClient.get(params).promise();
    return ret;
}
const setCpanel = async (field, value) =>{
    const params = {
        TableName: 'hivemind-ext',
        Key:{
            data:"controlpanel"
        },
        UpdateExpression: "SET #field =:a",
        ExpressionAttributeNames:{
            "#field": field
        },
        ExpressionAttributeValues:{
            ":a":value,
        },
    };
    return await documentClient.update(params).promise();
}
const setAllCpanel = async (data) =>{
    const params = {
        TableName: 'hivemind-ext',
        Key:{
            data:"controlpanel"
        },
        UpdateExpression: "SET #a =:a, #b =:b, #c =:c, #d =:d, #e =:e, #f =:f, #g =:g, #h =:h, #i =:i, #j =:j, #k =:k, #l =:l",
        ExpressionAttributeNames:{
            "#a": "p1life",
            "#b": "p2life",
            "#c": "p3life",
            "#d": "p4life",
            "#e": "p1score",
            "#f": "p2score",
            "#g": "p3score",
            "#h": "p4score",
            "#i": "stream1name",
            "#j": "stream2name",
            "#k": "stream3name",
            "#l": "stream4name",
        },
        ExpressionAttributeValues:{
            ":a": data.p1life,
            ":b": data.p2life,
            ":c": data.p3life,
            ":d": data.p4life,
            ":e": data.p1score,
            ":f": data.p2score,
            ":g": data.p3score,
            ":h": data.p4score,
            ":i": data.stream1name,
            ":j": data.stream2name,
            ":k": data.stream3name,
            ":l": data.stream4name,
        },
    };
    return await documentClient.update(params).promise();
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

const updateDB2 = async (word, question) =>{
    console.log("Updatedb2: "+ word);
    let params2 = {
        TableName: 'hivemind-words',
        Key: {
            "word": word
        },
    }
    let ret = await documentClient.get(params2).promise();
    console.log("ret DATA", ret)
    let mapped = false;
    let originalWord = word
    if(ret.hasOwnProperty("Item")){
        
        word = ret["Item"]["map"]
        if(ret == "XXXXX"){
            console.log("BLOCKED WORD EXIT EARLY", word)
            return
        }
        mapped = true
    }
    let catagory = "count//"+question;
    let params = {}
    if(mapped){
        let merged = "merge" + originalWord
        params = {
            TableName: 'hivemind-data',
            Key: {
                "placeholder": catagory,
                "word": word
            },
            UpdateExpression: 'ADD #a :y, #b :y',
            ExpressionAttributeNames: {
                '#a' : 'count',
                "#b" : merged
            },
            ExpressionAttributeValues: {
                ':y' : 1
            },
            ReturnValues: "UPDATED_NEW"
        };
    }else{
        params = {
            TableName: 'hivemind-data',
            Key: {
                "placeholder": catagory,
                "word": word
            },
            UpdateExpression: 'ADD #a :y',
            ExpressionAttributeNames: {'#a' : 'count'},
            ExpressionAttributeValues: {
                ':y' : 1
            },
            ReturnValues: "UPDATED_NEW"
        };
    }
    var datetime = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
    const params3 = {
        TableName: 'hivemind-usage',
        Key: {
            "date": datetime
        },
        UpdateExpression: 'ADD #a :y',
        ExpressionAttributeNames: {'#a' : 'count'},
        ExpressionAttributeValues: {
            ':y' : 1
        }
    }
    let [updated, updated2] = await Promise.all([documentClient.update(params).promise(), documentClient.update(params3).promise()])
    return updated
}
const updateCount = async (question, limit) =>{
    console.log("updateCount: "+ question +"::"+"limit");
    let catagory = "limit//"+question;
    const params = {
        TableName: 'hivemind-data',
        Key: {
            "placeholder": catagory,
            "word": "placeholder"
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
        ConsistentRead: false,
        ScanIndexForward: false
    }
    return await documentClient.query(params).promise();
}
const queryDB2 = async (placeholder) =>{
    let catagory = "vote//"+ placeholder;
    console.log("queryDB2----", catagory);
    const params = {
        TableName: 'hivemind-data',
        KeyConditionExpression: 'placeholder = :placeholder',
        ExpressionAttributeValues: {
            ':placeholder': catagory
        },
        ConsistentRead: false,
        ScanIndexForward: false
    }
    return await documentClient.query(params).promise();
}
const getWordMap = async () =>{
    console.log("GETTING WordMap")
    const params = {
        TableName: 'hivemind-words',
        ConsistentRead: false
    }
    let scanned = await documentClient.scan(params).promise();
    let hold = []
    let items = scanned.Items
    console.log("ITEMS SCANNED:",items.length, items)
    return(items)
}
const setWordMap = async (word,map) =>{
    console.log("Set WordMap: ", word,"--",map)
    const params = {
        TableName: 'hivemind-words',
        Key: {
            "word": word
        },
        UpdateExpression: 'SET #a = :y',
        ExpressionAttributeNames: {'#a' : 'map'},
        ExpressionAttributeValues: {
            ':y' : map
        },
    }
    let ret = await documentClient.update(params).promise();
    return(ret)
}
const addBlockedWord = async (word) =>{
    console.log("ADDING- ", word, " -to blocked words list")
    const params = {
        TableName: 'hivemind-words',
        Key: {
            "word": word,
        },
        UpdateExpression: 'SET #a = :y',
        ExpressionAttributeNames: {'#a' : 'map'},
        ExpressionAttributeValues: {
            ':y' : "XXXXX"
        },
    }
    let ret = await documentClient.update(params).promise();
    console.log("RET", ret)
    return(ret)
}
const deleteMap = async(word) =>{
    console.log("deleting map:", word)
    const params = {
        TableName: 'hivemind-words',
        Key: {
            "word": word
        }
    }
    let ret = await documentClient.delete(params).promise();
    return(ret)
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
    // console.log('question2.....',question2,vote,channel)
    let answer = data['answer']
    let params = {
        TableName: 'hivemind-votes',
        Key:{
            "question": answer,
            "channel": parseInt(channel)
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
    let params2 = {
        TableName: 'hivemind-votes',
        Key:{
            "question": answer,
            "channel": 0
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
    var datetime = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
    const params3 = {
        TableName: 'hivemind-usage',
        Key: {
            "date": datetime
        },
        UpdateExpression: 'ADD #a :y',
        ExpressionAttributeNames: {'#a' : 'count'},
        ExpressionAttributeValues: {
            ':y' : 1
        }
    }
    // let updated = await documentClient.update(params).promise();
    let [updated, updated2, updated3] = await Promise.all([documentClient.update(params).promise(), documentClient.update(params2).promise(), documentClient.update(params3).promise()]);
    return updated;
}
const removeQuestion = async(question) =>{
    console.log("removeQuestion: "+ question);
    let [qList, countQ, voteQ] = await Promise.all([addQuestion("",true), queryDB(question), queryDB2(question)]);
    let check = qList.indexOf(question)
    check = "REMOVE questionList["+check+"]"
    console.log("query---", check)
    let params = {
        TableName: 'hivemind-data',
        Key:{
            "placeholder": "questionHolder",
            "word": "placeholder"
        },
        UpdateExpression: check
    };
    let updated = await documentClient.update(params).promise();
    let deleteArray = [];
    let noError = true;
    countQ = countQ["Items"]
    voteQ = voteQ["Items"]
    countQ = countQ.concat(voteQ)
    let limitQ = {
        placeholder: "limit//"+question,
        word:"placeholder"
    }
    countQ.push(limitQ)
    console.log(countQ)
    for(let [index, item] of countQ.entries()){
        let tempItem = {
            DeleteRequest :{
                Key:{
                    placeholder: item.placeholder,
                    word: item.word,
                }
            }
        }
        deleteArray.push(tempItem)
        // console.log(countQ.length-1, index, countQ.length-1 == index, index+1 % 25, (index+1) % 25==0)
        if(((index+1) % 25==0) || (countQ.length-1 == index)){
            console.log("Deleting :",deleteArray.length," items")
            let params2 = {
                RequestItems : {
                    'hivemind-data' : deleteArray
                }
            };
            let res = await documentClient.batchWrite(params2).promise()
            console.log("!!!!!", res)
            if(res.UnprocessedItems.length>0){
                noError = false
                console.log("error flagged")
            }
            deleteArray = []
        }
    }
    
    // console.log("LLLLL", countQ)
    return noError;
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
       return(false)
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
    return(true)
}
const mergeAnswer = async (question, item, target) => {
    console.log("MERGING ANSWERS- ", item.word, 'into-',target.word, "for question", question)
    let ques = "count//"+question
    let params={
        TableName: 'hivemind-data',
        Key:{
            "placeholder": ques,
            "word": item.word
        },
        ReturnValues:"ALL_OLD"
    }
    let deleted = await documentClient.delete(params).promise();
    deleted = deleted['Attributes']
    console.log("DELETED ITEM:", deleted)
    let params2 = {
        TableName: 'hivemind-data',
        Key:{
            "placeholder": ques,
            "word": target.word
        },
        UpdateExpression: 'ADD #a :y SET #b = :y',
        ExpressionAttributeNames:{
            "#a": "count",
            "#b": "merge" + deleted['word']
        },
        ExpressionAttributeValues:{
            ":y": deleted['count'],
        },
        ReturnValues:"UPDATED_NEW"
    }
    let [updated, mapped] = await Promise.all([documentClient.update(params2).promise(), setWordMap(item.word,target.word)]);
    console.log("UPDATED =", updated)
    return true
}
const undoMerge = async (question, word, unmerge) => {
    console.log("UNMERGING--", unmerge, "from", word, "in question-", question)
    let ques = "count//"+question
    const params = {
        TableName: 'hivemind-data',
        Key:{
            "placeholder": ques,
            "word": word
        },
        UpdateExpression: 'REMOVE #a',
        ExpressionAttributeNames: { 
            '#a': unmerge
        },
        ReturnValues: 'UPDATED_OLD'
    };
    let [updated, results] = await Promise.all([documentClient.update(params).promise(), deleteMap(unmerge.substring(5))]);
    console.log("UPDATED---", updated)
    try {
        updated = updated['Attributes']
        let params2 = {
            TableName: 'hivemind-data',
            Key:{
                "placeholder": ques,
                "word": unmerge.substring(5)
            },
            UpdateExpression: 'SET #a = :y',
            ExpressionAttributeNames: { 
                '#a': "count"
            },
            ExpressionAttributeValues: {
                ':y': updated[unmerge]
            }
        }
        let minus = -1 * updated[unmerge]
        let params3 = {
            TableName: 'hivemind-data',
            Key:{
                "placeholder": ques,
                "word": word
            },
            UpdateExpression: 'ADD #a :y',
            ExpressionAttributeNames: { 
                '#a': "count"
            },
            ExpressionAttributeValues: {
                ':y': minus
            }
    };
        let [created, subtracted] = await Promise.all([documentClient.update(params2).promise(), documentClient.update(params3).promise()]);
        console.log("Created---", created)
        
    } catch (e) {
        console.error("UNMERGING ERROR", e)
    }
    return true
}
const renameWord = async (question, original, word) =>{
    console.log("renaming--", original, "to-", word, "in question-", question)
    let ques = "count//"+question
    let params = {
        TableName: 'hivemind-data',
        Key:{
            "placeholder":ques,
            "word":original
        },
        ReturnValues: 'ALL_OLD'
    }
    let deleted = await documentClient.delete(params).promise()
    console.log("Deleted==", deleted)
    deleted = deleted['Attributes']['count']
    let params2 = {
        TableName: 'hivemind-data',
        Key:{
            "placeholder":ques,
            "word":word
        },
        UpdateExpression: 'SET #a = :y',
        ExpressionAttributeNames: { 
            '#a': "count"
        },
        ExpressionAttributeValues: {
            ':y': deleted
        }
    }
    let updated = await documentClient.update(params2).promise()
    return true
}
const editCount = async (question, word, count) => {
    console.log("Changing count of word-", word, "to-", count, "for question-",question)
    let ques = "count//"+question
    let params = {
        TableName: 'hivemind-data',
        Key:{
            "placeholder":ques,
            "word":word
        },
        UpdateExpression: 'SET #a = :y',
        ExpressionAttributeNames: { 
            '#a': "count"
        },
        ExpressionAttributeValues: {
            ':y': parseInt(count)
        }
    }
    let updated = await documentClient.update(params).promise()
    return true
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
                try{
                    let [updated, ignore, broadcastResult] = await Promise.all([updateDB(catagory, payload),updateDB(catagory2, payload2),sendBroadcast(process.env.ownerId, JSON.stringify(message))]);

                }catch(e){
                    console.log(e)
                }
            }else if(catagory=='question'){
                let [updated, ignore, broadcastResult] = await Promise.all([updateDB(catagory, payload),sendBroadcast(process.env.ownerId, JSON.stringify(message))]);
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
        }else if(parsed['flag']=="add-question"){
            console.log("adding question: ", parsed["payload"])
            let res = await addQuestion(parsed["payload"])
            let ret = {
                id:"add-question",
                data: res
            }
            return ret
        }else if(parsed['flag']=="poll-ans"){
            console.log("flag = poll-ans")
            let payload = parsed['payload'];
            try{
                let payload2 = payload.split(" ")
                let filterArray = ["the", "a"]
                if(filterArray.includes(payload2[0])){
                    payload2.shift()
                    payload = payload2.join(" ")
                    console.log("article removed: ", payload)
                }
            }catch(e){
                console.log("catch triggered: ", e)
            }
            let question = parsed['question'];
            let limit = parsed['limit']
            let [updated, check] = await Promise.all([updateDB2(payload,question),updateCount(question)]);
            console.log("CHECK!!!!!----", check)
            check = check.Attributes.count
            if(limit != 0){
                if(check>= limit){
                    console.log("Limit hit: "+check+" > "+limit)
                    let message = {
                        data:{
                            identifier: "limitReached",
                            payload:"limitReached"
                        }
                    }
                    await sendBroadcast(String(process.env.ownerId), JSON.stringify(message));
                }   
            }
            let ret = {
                id: "poll-response",
                data: payload
            }
            return(ret)
        }else if(parsed['flag']=="vote"){
            await voteDB(parsed)
        }else if(parsed['flag']=="getResponses"){
            let question = parsed['question'];
            let results = await queryDB(question)
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
        }else if(parsed['flag']=='cpanelData'){
            console.log("get cpanelData")
            let results = await getDB2()
            let ret = {
                id:"cpanelData",
                data: results
            }
            return(ret)
        }else if(parsed['flag']=='setCpanel'){
            console.log("get setCpanel")
            let results = await setCpanel(parsed['field'],parsed['payload'])
            let ret = {
                id:"cpanelData",
                data: "success"
            }
            return(ret)
        }else if(parsed['flag']=='setAllCpanel'){
            console.log("setAllCpanel")
            let results = await setAllCpanel(parsed['payload'])
            let ret = {
                id:"setAllCpanel",
                data: "success"
            }
            return(ret)
        }else if(parsed['flag']=='removeQuestion'){
            console.log("removeQuestion")
            let results = await removeQuestion(parsed['payload'])
            let ret
            if(results){
                ret = {
                    id:"removeQuestion",
                    data: "success"
                }
            }else{
                ret = {
                    id:"removeQuestion",
                    data: "failure"
                }
            }
            return(ret)
        }else if(parsed['flag']=='addBlocked'){
            console.log("addBlocked")
            let results = await addBlockedWord(parsed['payload'])
            let ret = {
                    id:"addBlocked",
                    data: "success"
            }
            return(ret)
        }else if(parsed['flag']=='wordMap'){
            console.log("wordMap")
            let results = await getWordMap()
            let ret = {
                    id:"wordMap",
                    data: results
            }
            return(ret)
        }else if(parsed['flag']=='setMapWord'){
            console.log("setMapWord")
            let results = await setWordMap(parsed['payload'],parsed['map'])
            let ret = {
                    id:"setMapWord",
                    data: 'success'
            }
            return(ret)
        }else if(parsed['flag']=='deleteMap'){
            console.log("deleteMap")
            let results = await deleteMap(parsed['payload'])
            let ret = {
                    id:"deleteMap",
                    data: 'success'
            }
            return(ret)
        }else if(parsed['flag']=='mergeAnswer'){
            console.log("mergeAnswer")
            let results = await mergeAnswer(parsed['payload'],parsed['mergeItem'],parsed['mergeTarget']);
            let ret = {
                    id:"mergeAnswer",
                    data: results
            }
            return(ret)
        }else if(parsed['flag']=='undoMerge'){
            console.log("undoMerge")
            let results = await undoMerge(parsed['payload'],parsed['word'],parsed['unmerge']);
            let ret = {
                    id:"undoMerge",
                    data: 'success'
            }
            return(ret)
        }else if(parsed['flag']=='renameWord'){
            console.log("renameWord")
            let results = await renameWord(parsed['payload'],parsed['original'],parsed['word']);
            let ret = {
                    id:"renameWord",
                    data: 'success'
            }
            return(ret)
        }else if(parsed['flag']=='editCount'){
            console.log("editCount")
            let results = await editCount(parsed['payload'],parsed['word'],parsed['count']);
            let ret = {
                    id:"editCount",
                    data: 'success'
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
            correct: ret['Item']['correct'],
            limit: ret['Item']['limit'],
            displayLimit: ret['Item']['displayLimit'],
            displayQuestion: ret['Item']['displayQuestion']
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
    // console.log("EVENT",event)
    let parsed;
    try{
        parsed = JSON.parse(event['body'])
    }catch(e){
        parsed = event['body'];
    }
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
