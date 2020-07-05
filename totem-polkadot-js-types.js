// Updates to this file should always check the change log for compatibility issues
// https://raw.githubusercontent.com/polkadot-js/api/master/CHANGELOG.md
export default {
    "OpenTip": "OpenTipTo225", // ## 1.22.1 Jun 30, 2020
    "DispatchInfo": "DispatchInfoTo244" // ## 1.14.1 May 14, 2020
    "Weight": "u32", // ## 1.11.1 Apr 21, 2020
    "StakingLedger": "StakingLedgerTo240", // ## 1.10.1 Apr 13, 2020
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
    "OrderItemStruct": {
        "ProductHash": "Hash",
        "UnitPrice": "i128",
        "Quantity": "i128",
        "UnitOfMeasure": "u16"
    },
    "OrderItem": "Vec<OrderItemStruct>",
    "OrderStatus": "u16",
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