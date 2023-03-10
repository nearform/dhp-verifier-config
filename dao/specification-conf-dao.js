/* eslint-disable no-return-await */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable complexity */
/**
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 * 
*/

const dbHelper = require('../helpers/nosql-db-helper');
const constants = require('../helpers/constants');
const { getErrorInfo } = require('../helpers/utils');
const ruleDao = require('./rules-dao');
const displaysDao = require('./displays-dao');
const trustListDao = require('./trustlist-dao');
const classifierRulesDao = require('./classifier-rule-dao');
const masterdataDao = require('./masterdata-dao');
const Logger = require('../config/logger');
const logger = new Logger('specificationConf-dao');



const getSpecificationConf = async (id, version) => {
    try {
        logger.debug(`get SpecificationConf doc id: ${id} ${version}`); 
        const retDoc = await dbHelper.getInstance().getDoc(
            constants.NOSQL_CONTAINER_ID.SPECIFICATION_CONFIG_ENTITY, id, version
        );
        return await dbHelper.getInstance().sanitizeDoc(retDoc);
    } catch(err) {
        const { errorStatus } = getErrorInfo(err);
        if (errorStatus === 404) {
            const error = new Error('SpecificationConf not found');
            error.status = errorStatus;
            throw error;
        }
        throw err;
    }
}

const addSpecificationConf = async (entity) => {
    const entityCopy = JSON.parse(JSON.stringify(entity));
                
    
    logger.debug(`Adding SpecificationConf doc id ${entity.id} ${entity.version}`);    
    
    const entitySaved = await dbHelper.getInstance().writeDoc(
        constants.NOSQL_CONTAINER_ID.SPECIFICATION_CONFIG_ENTITY,
        entityCopy
    );
    return await dbHelper.getInstance().sanitizeDoc(entitySaved);
}

const CREDENTIAL_CATEGORY = "credential-category";
const CREDENTIAL_SPEC = "credential-spec";

const getExpandedSpecificationConf = async (id, version) => {
    const specConf = await getSpecificationConf(dbHelper.stringifyIdVersion(id, version), version)
    let configBroken = false;
    // expandSpecificationConfigurationConfigs : embedded ids
    try {    
        if(specConf.trustLists) {
            const trustListsExp = [];
            for await (const trustObj of specConf.trustLists) {
                const version = trustObj.version === 'latest' ? '1.0.0' : trustObj.version
                const tl = await trustListDao.getTrustList(dbHelper.stringifyIdVersion(trustObj.id, version), version);
                // const tl = await trustListDao.getTrustList(trustObj.id, trustObj.version);
                trustListsExp.push(tl);  
            }            
            specConf.trustLists = trustListsExp;
        }
   
        if(specConf.rules) {
            const rulesExp = [];
            for await(const rObj of specConf.rules) {
                const version = rObj.version === 'latest' ? '1.0.0' : rObj.version
                const tl = await ruleDao.getRule(dbHelper.stringifyIdVersion(rObj.id, version), version);
                // const tl = await ruleDao.getRule(rObj.id, rObj.version);
                rulesExp.push(tl);  
            }            
            specConf.rules = rulesExp;
        }

        if(specConf.display) {
            const displayExp = [];
            for (const dObj of specConf.display) {
                const version = dObj.version === 'latest' ? '1.0.0' : dObj.version
                const tl = await displaysDao.getDisplays(dbHelper.stringifyIdVersion(dObj.id, version), version);
                // const tl = await displaysDao.getDisplays(dObj.id, dObj.version);
                displayExp.push(tl);  
            }            
            specConf.display = displayExp;
        }

        if(specConf.classifierRule) {
            const version = specConf.classifierRule.version === 'latest' ? '1.0.0' : specConf.classifierRule.version
            specConf.classifierRule = await classifierRulesDao.getClassifierRules(dbHelper.stringifyIdVersion(specConf.classifierRule.id, version), version);                
            // specConf.classifierRule = await classifierRulesDao.getClassifierRules(specConf.classifierRule.id, specConf.classifierRule.version);                
        }
    } catch(err) {
        configBroken = true;
    }

    try {
        // validate CredentialSpecDisplayValue
        if(specConf.credentialSpec) {
            const confValue = specConf.credentialSpec;
            delete specConf.credentialSpec;
            const entityToValidate = await masterdataDao.getMasterData(dbHelper.stringifyIdVersion(CREDENTIAL_SPEC, '1.0.0'));
            if(entityToValidate.items) {
                for (const item of entityToValidate.items) {
                    if(item.id ===confValue) {
                        specConf.credentialSpec = confValue;
                        break;
                    }
                }   
            }               
        }

        if(specConf.credentialCategory) {
            const confValue = specConf.credentialCategory;
            delete specConf.credentialCategory;
            const entityToValidate = await masterdataDao.getMasterData(dbHelper.stringifyIdVersion(CREDENTIAL_CATEGORY, '1.0.0'));
            if(entityToValidate.items) {
                for (const item of entityToValidate.items) {
                    if(item.id ===confValue) {
                        specConf.credentialCategory = confValue;
                        break;
                    }
                }   
            }               
        }
    } catch(err) {
        const { errorStatus } = getErrorInfo(err);
        if (errorStatus === 404) {
            const error = new Error('credential-spec / credential-category not found');
            error.status = errorStatus;
            throw error;
        }
        throw err;
    }

    if (configBroken)
        throw new Error(
            `Verifier configuration is broken. Details id: ${id} version: ${version}`
        ); 

    return dbHelper.getInstance().sanitizeDoc(specConf);  
}


module.exports = {
    getSpecificationConf,
    addSpecificationConf,
    getExpandedSpecificationConf    
}