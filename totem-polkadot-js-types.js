export default {
    "AcceptAssignedStatus": "bool",
    "Account": "u64",
    "AccountOf": "Account",
    // "AccountBalance": "i128", Not impl in this version of polkadot
    "AccountBalance": "i64",
    "AccountBalanceOf": "AccountBalance",
    "ApprovalStatus": "u16",
    "Archival": "bool",
    // "Balance": "u128", Not impl in this version of polkadot
    "Balance": "u64",
    "CurrencyBalanceOf": "Balance",
    "BanStatus": "bool",
    "BoxNonce": "Vec<u8>",
    "Data": "Vec<u8>",
    "DataHash": "Hash",
    "DeletedProject": "Hash",
    "Ed25519signature": "H512",
    "EncryptNonce": "u64",
    "EncryptPublicKey": "H256",
    "Indicator": "bool",
    "LockStatus": "bool",
    "NumberOfBreaks": "u16",
    "NumberOfBlocks": "u64",
    "PostingPeriod": "u16",
    "Product": "Hash",
    "ProjectHash": "Hash",
    "ProjectHashRef": "Hash",
    "ProjectStatus": "u16",
    "OrderSubHeader": {
        "buy_or_sell": "u16",
        "amount": "AccountBalanceOf",
        "open_closed": "bool",
        "order_type": "u16",
        "deadline": "u64",
        "due_date": "u64"
    },
    "OrderStatus": "u16",
    // "Quantity": "u128", Not impl in this version of polkadot
    "Quantity": "u64",
    "RandomHashedData": "Hash",
    "ReasonCode": "u16",
    "ReasonCodeType": "u16",
    "RecordHash": "Hash",
    "RecordType": "u16",
    "StartOrEndBlockNumber": "u64",
    "Status": "u16",
    "StatusOfTimeRecord": "u16",
    "SignedBy": "H256",
    "TimeReferenceHash": "Hash",
    "TimeHash": "TimeReferenceHash",
    // "UnitPrice": "i128", Not impl in this version of polkadot
    "UnitPrice": "i64",
    "UnitOfMeasure": "u16",
    "UnLocked": "bool",
    "UserNameHash": "Hash",
    "OrderItemStruct": {
        "ProductKey": "Product",
        "UnitPriceKey": "UnitPrice",
        "QuantityKey": "Quantity",
        "UnitOfMeasureKey": "UnitOfMeasure"
    },
    "OrderItemStruct<Product,UnitPrice,Quantity,UnitOfMeasure>": "OrderItemStruct",
    "OrderItem": "Vec<OrderItemStruct>",
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
        "project_hash": "ProjectHashRef",
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
    "Timekeeper<AccountId,ProjectHashRef,NumberOfBlocks,LockStatus,\nStatusOfTimeRecord,ReasonCodeStruct,PostingPeriod,StartOrEndBlockNumber,\nNumberOfBreaks>": "Timekeeper"
}