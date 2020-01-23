export default {
    "AcceptAssignedStatus": "bool",
    "Archival": "bool",
    "BanStatus": "bool",
    "BoxNonce": "Vec<u8>",
    "Data": "Vec<u8>",
    "DeletedProject": "Hash",
    "Ed25519signature": "H512",
    "EncryptNonce": "u64",
    "EncryptPublicKey": "H256",
    "LockStatus": "bool",
    "NumberOfBreaks": "u16",
    "NumberOfBlocks": "u64",
    "PostingPeriod": "u16",
    "ProjectHash": "Hash",
    "ProjectHashRef": "Hash",
    "ProjectStatus": "u16",
    "RandomHashedData": "Hash",
    "ReasonCode": "u16",
    "ReasonCodeType": "u16",
    "RecordType": "u16",
    "StartOrEndBlockNumber": "u64",
    "StatusOfTimeRecord": "u16",
    "SignedBy": "H256",
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