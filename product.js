'use strict';
const shim = require('fabric-shim');
const util = require('util');
var log4js = require('log4js');
var logger = log4js.getLogger('ChaincodeLogger');

// ===============================================
// Chaincode name:[product.js]
// ===============================================
let Chaincode = class {
    async Init(stub) {
        let ret = stub.getFunctionAndParameters();
        logger.info(ret);
        logger.info('=========== Instantiated Chaincode ===========');
        return shim.success();
    }

    async Invoke(stub) {
        logger.info('Transaction ID: ' + stub.getTxID());
        logger.info(util.format('Args: %j', stub.getArgs()));

        let ret = stub.getFunctionAndParameters();
        logger.info(ret);

        let method = this[ret.fcn];
        if (!method) {
            logger.error('no function of name:' + ret.fcn + ' found');
            throw new Error('Received unknown function ' + ret.fcn + ' invocation');
        }
        try {
            let payload = await method(stub, ret.params, this);
            return shim.success(payload);
        } catch (err) {
            logger.error(err);
            return shim.error(err);
        }
    }
	
	async getCurrentUserId(ctx) {

        let id = [];
        id.push(ctx.clientIdentity.getID());
        var begin = id[0].indexOf("/CN=");
        var end = id[0].lastIndexOf("::/C=");
        let userid = id[0].substring(begin + 4, end);
        return userid;
    }
    async getCurrentUserType(ctx) {

        let userid = await this.getCurrentUserId(ctx);

        if (userid == "admin") {
            return userid;
        }
        const usertype =  await ctx.clientIdentity.getAttributeValue("usertype");
        return usertype;
    }


	// ===============================================
    // createProduct - create a Product in chaincode state
    // Args - productId, productName, description, productQuantity, unit, processedProductQuantity, amount, currency, ownerBp
    // ===============================================
    async createProduct(stub, args, thisClass) {
        if (args.length != 9) {
            throw new Error('Incorrect number of arguments. Expecting 9.');
        }

        let productState = await stub.getState("product_" + args[0]);
        if (productState && productState.toString()) {
            throw new Error('This product already exists: ' + args[0]);
        }
        logger.info('--- start createProduct for: ' + args[0]);
        let productId = args[0];
        let productName = args[1];
        let description = args[2];
        let productQuantity = args[3];
        let unit = args[4];
        let processedProductQuantity = args[5];
        let amount = args[6];
        let currency = args[7];
        let ownerBp = args[8];
        

        if (!productName) {
            throw new Error('Argument productName must be a non-empty string')
        }
        if (!description) {
            throw new Error('Argument product description must be a non-empty string');
        }
        if (!productQuantity) {
            throw new Error('Argument productQuantity must be a non-empty string');
        }
        if (!unit) {
            throw new Error('Argument unit must be a non-empty string');
        }
        if (!processedProductQuantity) {
            throw new Error('Argument processedProductQuantity must be a non-empty string');
        }
        if (!amount) {
            throw new Error('Argument amount must be a non-empty string');
        }
        if (!currency) {
            throw new Error('Argument currency must be a non-empty string');
        }
        if (!ownerBp) {
            throw new Error('Argument ownerBp must be a non-empty string');
        }

        let bpAsBytes = await stub.getState("bp_" + ownerBp);
        if (!bpAsBytes || !bpAsBytes.toString()) {
            let jsonResp = {};
            jsonResp.errorMsg = 'Business partner does not exist: ' + ownerBp;
            throw new Error(JSON.stringify(jsonResp));
        }

        
        let product = {};
        product.docType = 'product';
        product.productId = productId;
        product.description = description;
        product.productQuantity = productQuantity;
        product.processedProductQuantity = '';
        product.unit = unit;
        product.amount = amount;
        product.currency = currency;
        product.ownerBp = ownerBp;
        product.productDeliveryFlag = productDeliveryFlag;
        await stub.putState("product_" + productId, Buffer.from(JSON.stringify(product)));
    }

	// ===============================================
    // queryProduct- read a product from chaincode state by key
    // Args - productId
    // ===============================================
    async queryProduct(stub, args, thisClass) {
		var usertype = await this.getCurrentUserType(ctx);
        if( usertype != "admin"){
            throw new Error(`You don't have permission to do this`);
        }
        if (args.length != 1) {
            throw new Error('Incorrect number of arguments. Expecting key of the asset to query')
        }

        let key = args[0]
        if (!key) {
            throw new Error(' productId key must not be empty')
        }

        let productAsBytes = await stub.getState("product_" + key)
        if (!productAsBytes || !productAsBytes.toString()) {
            let jsonResp = {}
            jsonResp.errorMsg = 'Product does not exist: ' + key
            throw new Error(JSON.stringify(jsonResp))
        }

        logger.info('=======================================')
        logger.info(productAsBytes.toString())
        logger.info('=======================================')
        return productAsBytes;
    }
	
	
	 // ===========================================================
    // updateProduct - Update Product updates an asset for a certain field
    // Args - productId, productName, description, productQuantity, unit, processedProductQuantity, amount, currency, ownerBp, productDeliveryFlag, productDeliveryUpdate
    // ===========================================================
    async updateProduct(stub, args, thisClass) {
        if (args.length != 11) {
            throw new Error('Incorrect number of arguments. Expecting key and new values(11).')
        }

        let product = {};
        product.productId = args[0];
        product.productName = args[1];
        product.description = args[2];
        product.productQuantity = args[3];
        product.unit = args[4];
        product.processedProductQuantity = args[5];
        product.amount = args[6];
        product.currency = args[7];
        product.ownerBp = args[8];
        product.productDeliveryFlag = args[9];
        product.productDeliveryUpdate = args[10];

        logger.info('- Start updating product - ')
        let existingProductAsBytes = await stub.getState("product_" + product.productId)
        if (!existingProductAsBytes || !existingProductAsBytes.toString()) {
            throw new Error('Product %s does not exist', product.productId)
        }

        let productAsset;
        try {
            productAsset = JSON.parse(existingProductAsBytes.toString())
        } catch (err) {
            let jsonResp = {}
            jsonResp.errorMsg = 'Failed to decode JSON of: ' + product.productId
            throw new Error(JSON.stringify(jsonResp));
        }
        logger.info('Existing product: ' + productAsset)

        let productAsBytes = Buffer.from(JSON.stringify(product));
        await stub.putState("product_" + product.productId, productAsBytes);
        logger.info('- End update product (success) -');
    }
	
	// ==================================================
    // deleteProduct - remove product from the state
    // Args - productId, contractId
    // ==================================================
    async deleteProduct(stub, args, thisClass) {
		var usertype = await this.getCurrentUserType(ctx);
        if( usertype != "admin"){
            throw new Error(`You don't have permission to do this`);
        }
        if (args.length != 2) {
            throw new Error('Incorrect number of arguments. Expecting productId of the asset to delete and contractId')
        }
        let productId = args[0]
        let contractId = args[1]
        if (!productId || !contractId) {
            throw new Error('Both productId and contractId must be provided')
        }
        let prodAsbytes = await stub.getState("product_" + productId)
        let jsonResp = {}
        if (!prodAsbytes || !prodAsbytes.toString()) {
            jsonResp.errorMsg = 'Product does not exist: ' + productId
            throw new Error(JSON.stringify(jsonResp));
        }

        let contractAsbytes = await stub.getState("contract_" + contractId);
        if (!contractAsbytes || !contractAsbytes.toString()) {
            throw new Error('Contract %s does not exist.', contractId);
        }
        let contract = JSON.parse(contractAsbytes.toString());
        let index = contract.products.indexOf(productId);

        //checking whether the contract is completed or not
        if (contractAsset.contractStatus == "completed"){
            let jsonResp = {};
            jsonResp.success = false
            jsonResp.errorCode = 'C-10007';
            jsonResp.errorMsg = 'Contract is in complete state : #' + contractId + '#'
            throw new Error(JSON.stringify(jsonResp));
        }

        if (index < 0) {
            throw new Error('The product %s is not part of the contract %s ' + productId, contractId);
        }

        await stub.deleteState("product_" + productId);
        contract.products.splice(index, 1);
        await stub.putState("contract_" + contractId, Buffer.from(JSON.stringify(contract)));
    }
	
	
    // ===============================================
    // queryAllProducts - to query all products
    // ===============================================
    async queryAllProducts(stub, args, thisClass) {
	    var usertype = await this.getCurrentUserType(ctx);
        if( usertype != "admin"){
            throw new Error(`You don't have permission to do this`);
        }
        let queryString = {};
        queryString.selector = {};
        queryString.selector.docType = 'product';
        let method = thisClass['getQueryResultForQueryString'];
        let queryResults = await method(stub, JSON.stringify(queryString), thisClass);
        return queryResults; //shim.success(queryResults);
    }
	
	// ===============================================
    // getQueryResultForQueryString - support function for all asset query
    // ===============================================
    async getQueryResultForQueryString(stub, queryString, thisClass) {

        console.info('- getQueryResultForQueryString queryString:\n' + queryString)
        let resultsIterator = await stub.getQueryResult(queryString);
        let method = thisClass['getAllResults'];
        let results = await method(resultsIterator, false);
        return Buffer.from(JSON.stringify(results));
    }
	
	
	// ===============================================
    // getAllResults - packs the results to JSON array
    // ===============================================
    async getAllResults(iterator, isHistory) {
        let allResults = []
        while (true) {
            let res = await iterator.next()

            if (res.value && res.value.value.toString()) {
                let jsonRes = {}
                logger.info(res.value.value.toString('utf8'))
                if (isHistory && isHistory === true) {
                    jsonRes.TxId = res.value.tx_id
                    jsonRes.Timestamp = res.value.timestamp
                    jsonRes.IsDelete = res.value.is_delete.toString()
                    try {
                        jsonRes.Value = JSON.parse(res.value.value.toString('utf8'))
                    } catch (err) {
                        logger.error(err)
                        jsonRes.Value = res.value.value.toString('utf8')
                    }
                } else {
                    jsonRes.Key = res.value.key
                    try {
                        jsonRes.Record = JSON.parse(res.value.value.toString('utf8'))
                    } catch (err) {
                        logger.error(err)
                        jsonRes.Record = res.value.value.toString('utf8')
                    }
                }
                allResults.push(jsonRes)
            }
            if (res.done) {
                logger.info('end of data')
                await iterator.close()
                logger.info(allResults)
                return allResults
            }
        }
    }
