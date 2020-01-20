export default {
    "Archival": "bool",
    "ProjectHash": "Hash",
    "DeletedProject": "Hash",
    "ProjectStatus": "u16",
    "AcceptAssignedStatus": "bool",
    "BanStatus": "bool",
    "LockStatus": "bool",
    "ReasonCode": "u16",
    "ReasonCodeType": "u16",
    "NumberOfBreaks": "u16",
    "NumberOfBlocks": "u64",
    "PostingPeriod": "u16",
    "ProjectHashRef": "Hash",
    "StartOrEndBlockNumber": "u64",
    "StatusOfTimeRecord": "u16",
    "RecordType": "u16",
    "EncryptPublicKey": "H256",
    "BoxNonce": "Vec<u8>",
    "EncryptNonce": "u64",
    "UserNameHash": "Hash",
    "RandomHashedData": "Hash",
    "Ed25519signature": "H512",
    "SignedBy": "H256",
    "Data": "Vec<u8>",
    "SignedData": {
        "user_hash": "UserNameHash",
        "pub_enc_key": "EncryptPublicKey",
        "pub_sign_key": "SignedBy",
        "nonce": "EncryptNonce"
    },
    "SignedData<UserNameHash, EncryptPublicKey, SignedBy, EncryptNonce>": "SignedData",
    "EncryptedVerificationData": {
        "key": "EncryptPublicKey",
        "data": "Data"
    },
    "EncryptedVerificationData<EncryptPublicKey, Data> ": "EncryptedVerificationData",
    "ReasonCodeStruct": {
        "ReasonCodeKey": "ReasonCode",
        "ReasonCodeTypeKey": "ReasonCodeType"
    },
    "ReasonCodeStruct<ReasonCode,ReasonCodeType>": "ReasonCodeStruct",
    "BannedStruct": {
        "BanStatusKey": "BanStatus",
        "ReasonCodeStructKey": "ReasonCodeStruct"
    },
    "BannedStruct<BanStatus,ReasonCodeStruct>": "BannedStruct",
    "Timekeeper": {
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