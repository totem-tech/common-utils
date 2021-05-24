export default {
    "LockIdentifier": "[u8; 8]",
    "BalanceLockV1": {
        "id": "LockIdentifier",
        "amount": "Balance",
        "until": "BlockNumber",
        "reasons": "WithdrawReasons"
    },
    "BalanceLockV1<[u8; 8],u64,u64,i8>": "BalanceLockV1",
    "AcceptAssignedStatus": "bool",
    "Account": "u64",
    "AccountOf": "Account",
    "AccountBalance": "i128",
    "AccountBalanceOf": "i128",
    "AccountBalanceOf<T>": "i128",
    // "ApprovalStatus": "u16",
    "ApprovalStatus": {
        "_enum": {
            "Submitted": "u16",
            "Accepted": "u16",
            "Rejected": "u16",
        }
    },
    "Archival": "bool",
    "Balance": "u128",
    "BanStatus": "bool",
    "BoxNonce": "Vec<u8>",
    "ComparisonAmounts": "u128",
    "CurrencyBalanceOf": "Balance",
    "Data": "Vec<u8>",
    "DeletedProject": "Hash",
    "Ed25519signature": "H512",
    "EncryptNonce": "u64",
    "EncryptPublicKey": "H256",
    "Indicator": {
        "_enum": {
            "Debit": "u8",
            "Credit": "u8"
        }
    },
    "LedgerBalance": "i128",
    "LockStatus": "bool",
    "NumberOfBreaks": "u16",
    "NumberOfBlocks": "u64",
    "PostingPeriod": "u16",
    "PostingIndex": "u128",
    "ProjectHash": "Hash",
    "ProjectStatus": "u16",
    "OrderStatus": "u16",
    "RandomHashedData": "Hash",
    "ReasonCode": "u16",
    "ReasonCodeType": "u16",
    "RecordType": "u16",
    "StartOrEndBlockNumber": "u64",
    "Status": "u16",
    "StatusOfTimeRecord": {
        "_enum": {
            "Draft": "u16",
            "Submitted": "u16",
            "Disputed": "u16",
            "Rejected": "u16",
            "Accepted": "u16",
            "Invoiced": "u16",
            "Blocked": "u16"
        }
    },
    "SignedBy": "H256",
    "TimeReferenceHash": "Hash",
    "TimeHash": "TimeReferenceHash",
    "UnLocked": "bool",
    "UserNameHash": "Hash",
    "EncryptedVerificationData": {
        "key": "EncryptPublicKey",
        "data": "Data"
    },
    "EncryptedVerificationData<EncryptPublicKey, Data>": "EncryptedVerificationData",
    "ReasonCodeStruct": {
        "ReasonCodeKey": "ReasonCode",
        "ReasonCodeTypeKey": "ReasonCodeType"
    },
    "ReasonCodeStruct<ReasonCode,ReasonCodeType>": "ReasonCodeStruct",
    "SignedData": {
        "user_hash": "UserNameHash",
        "pub_enc_key": "EncryptPublicKey",
        "pub_sign_key": "SignedBy",
        "nonce": "EncryptNonce"
    },
    "SignedData<UserNameHash, EncryptPublicKey, SignedBy, EncryptNonce>": "SignedData",
    "BannedStruct": {
        "BanStatusKey": "BanStatus",
        "ReasonCodeStructKey": "ReasonCodeStruct"
    },
    "BannedStruct<BanStatus,ReasonCodeStruct>": "BannedStruct",
    "Timekeeper": {
        "worker": "AccountId",
        "project_hash": "Hash",
        "total_blocks": "NumberOfBlocks",
        "locked_status": "LockStatus",
        "locked_reason": "ReasonCodeStruct",
        "submit_status": "StatusOfTimeRecord",
        "reason_code": "ReasonCodeStruct",
        "posting_period": "PostingPeriod",
        "start_block": "StartOrEndBlockNumber",
        "end_block": "StartOrEndBlockNumber",
        "nr_of_breaks": "NumberOfBreaks"
    },
    "Timekeeper<AccountId,Hash,NumberOfBlocks,LockStatus,\nStatusOfTimeRecord,ReasonCodeStruct,PostingPeriod,StartOrEndBlockNumber,\nNumberOfBreaks>": "Timekeeper",
    "OrderHeader": {
        "owner": "AccountId",
        "fulfiller": "AccountId",
        "approver": "AccountId",
        "orderStatus": "u16",
        "approvalStatus": "u16",
        "isSell": "u16",
        "amountXTX": "i128",
        "isMarket": "bool",
        "orderType": "u16",
        "deadline": "u64",
        "dueDate": "u64"
    },
    "OrderHeader<AccountId,AccountId,AccountId,u16,u16,u16,i128,bool,u16,u64,u64>": "OrderHeader",
    "OrderItem": {
        "product": "Hash",
        "unitPrice": "i128",
        "quantity": "u128",
        "unitOfMeasure": "u16"
    },
    "OrderItem<Hash,i128,u128,u16>": "OrderItem",
    "TXKeysL": {
        "recordId": "Hash",
        "parentId": "Hash",
        "bonsaiToken": "Hash",
        "txID": "Hash"
    },
    "TXKeysL<Hash,Hash,Hash,Hash>": "TXKeysL",
    "TXKeysM": {
        "recordId": "Hash",
        "bonsaiToken": "Hash",
        "txID": "Hash"
    },
    "TXKeysM<Hash,Hash,Hash>": "TXKeysM",
    "TXKeysS": {
        "bonsaiToken": "Hash",
        "txID": "Hash"
    },
    "TXKeysS<Hash,Hash>": "TXKeysS",
    "TXKeysT": {
        "txID": 'Hash',
    },
    'TXKeysT<Hash>': 'TXKeysT',
    "ProjectHashRef": "H256",
}