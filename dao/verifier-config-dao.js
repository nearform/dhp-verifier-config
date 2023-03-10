/* eslint-disable prefer-destructuring */
/* eslint-disable complexity */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/**
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 *  SPDX-Licence-Identifier: Apache 2.0
*/

const dbHelper = require('../helpers/nosql-db-helper');
const constants = require('../helpers/constants');
const valueSetDao = require('./valueset-dao');
const specificationConfDao = require('./specification-conf-dao');
const { getErrorInfo } = require('../helpers/utils');
const Logger = require('../config/logger');

const logger = new Logger('verifier-configapi-dao');

const credentialSpec = {
    "DCC": "EU Digital COVID Certificate",
    "GHP": "Good Health Pass",
    "IDHP": "Digital Health Pass",
    "SHC": "Smart Health Card",
    "VC": "Verifiable Credential",
}

const credentialCategory = {
    "VACCINATION": "COVID-19 Vaccination",
    "TEST": "COVID-19 Test Result",
    "RECOVERY": "COVID-19 Recovery",
    "TEMPERATURE": "Temperature Scan",
    "PASS": "Pass",
    "GENERIC": "Generic Credential",
}

const getVerifierConfigurations = async (id, version) => {
    logger.info(`getVerifierConfigurations - id=${id}, version=${version}`)
    try {
        if (id && version) {
            const stringifiedId = id && version && !id.includes(';') ? dbHelper.stringifyIdVersion(id, version) : id
            const updatedVersion = (!version || version === 'latest') ? '1.0.0' : version

            const retDoc = await dbHelper.getInstance().getDoc(constants.NOSQL_CONTAINER_ID.VERIFIER_CONFIGURATIONS_ENTITY, stringifiedId, updatedVersion);
            if (!retDoc) throw new Error('VerifierConfigurations not found')

            return retDoc;
        }
        const retDocs = await dbHelper.getInstance().getAllDocs(constants.NOSQL_CONTAINER_ID.VERIFIER_CONFIGURATIONS_ENTITY);
        // TODO: sanitizeDoc
        const allDocs = retDocs.payload || []
        return allDocs.map(d => {
            const document = d.doc;
            document.id = document._id.split(';')[0];
            delete document._id
            delete document._rev
            return document
        })
    } catch(err) {
        const { errorStatus } = getErrorInfo(err);
        if (errorStatus === 404) {
            const error = new Error('VerifierConfigurations not found');
            error.status = errorStatus;
            throw error;
        }
        throw err;
    }
}


/*
 Model
  base: createdOrg, createdUser, createdAt, updatedAt, entity
  attributes
    name, customer, customerId , organization, organizationId, label, offline, masterCatalog, refresh, verifierType, configuration
    List: specificationConfigurations, valueSets, disabledSpecifications, disabledRules
 */
const addVerifierConfigurations = async (entity) => {
    const entityCopy = JSON.parse(JSON.stringify(entity));
    
    // const id = `${schema.id};v=${schema.version}`;
    const id = `${entity.id}`;

    entityCopy.id = id;
        
    entityCopy.name = entity.name;

    
    const entitySaved = await dbHelper.getInstance().writeDoc(
        constants.NOSQL_CONTAINER_ID.VERIFIER_CONFIGURATIONS_ENTITY,
        entityCopy
    );
    return await dbHelper.getInstance().sanitizeDoc(entitySaved);
}

const deleteVerifierConfigurations = async (eID) => {
    try {
        const retDoc = await dbHelper.getInstance().deleteDoc(
            constants.NOSQL_CONTAINER_ID.VERIFIER_CONFIGURATIONS_ENTITY, eID
        );
        return await dbHelper.getInstance().sanitizeDoc(retDoc);
    } catch(err) {
        const { errorStatus } = getErrorInfo(err);
        if (errorStatus === 404) {
            const error = new Error('Rule not found');
            error.status = errorStatus;
            throw error;
        }
        throw err;
    }
}

const getExpandedVerifierConfigurations = async (id, version) => {
    const retrievedConf = await getVerifierConfigurations(dbHelper.stringifyIdVersion(id, version), version)

    try {
        logger.info(`Expanding entities in  VerifierConfiguration: ${id} ${version}`);
        
        if(retrievedConf.specificationConfigurations) {
            const confListsExp = [];
            for (const specObj of retrievedConf.specificationConfigurations) {
                const tl = await specificationConfDao.getExpandedSpecificationConf(specObj.id, specObj.version);
                tl.credentialSpecDisplayValue = credentialSpec[tl.credentialSpec]
                tl.credentialCategoryDisplayValue = credentialCategory[tl.credentialCategory]
                confListsExp.push(tl);
            }
            retrievedConf.specificationConfigurations = confListsExp;
        }
        
        // valueSets
        if(retrievedConf.valueSets) {
            const confListsExp = [];
            for (const specObj of retrievedConf.valueSets) {
                const tl = await valueSetDao.getValueSets(dbHelper.stringifyIdVersion(specObj.id, version), specObj.version);
                confListsExp.push(tl);  
            }            
            retrievedConf.valueSets = confListsExp;
        }
        
        return await dbHelper.getInstance().sanitizeDoc(retrievedConf);  
    } catch(err) {
        const { errorStatus } = getErrorInfo(err);
        if (errorStatus === 404) {
            const error = new Error(`VerifierConfiguration elements not found : ${err}`);
            error.status = errorStatus;
            throw error;
        }
        logger.error(`VerifierConfiguration element lookup failed : ${err}`);
        throw err;
    }   
}

module.exports = {
    getVerifierConfigurations,
    addVerifierConfigurations,
    getExpandedVerifierConfigurations
}