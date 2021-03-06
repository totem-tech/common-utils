// Updates to this file should always check the change log for compatibility issues
// https://raw.githubusercontent.com/polkadot-js/api/master/CHANGELOG.md
export default {
    // "Digest": "Hash",
    "Vote": "i8",
    "ReferendumIndex": "u32",
    "VoteOf": {
        "referendumIndex": "ReferendumIndex",
        "account": "AccountId",
    },
    "OpenTip": "OpenTipTo225", // ## 1.22.1 Jun 30, 2020
    "DispatchInfo": "DispatchInfoTo244", // ## 1.14.1 May 14, 2020
    "Weight": "u32", // ## 1.11.1 Apr 21, 2020
    "StakingLedger": "StakingLedgerTo240", // ## 1.10.1 Apr 13, 2020
    // "Address": "AccountId", // Comments in Riot Channel
    "Address": "GenericAddress",
    "LookupSource": "GenericAddress",
    "DispatchResult": "DispatchResultTo198", // from PolkadotJS types
    "EventRecord": "EventRecordTo76", // from PolkadotJS types
    // "Event": "Vec<EventRecord>", // Comments in Riot Channel
    // "Storage": "Vec<StorageKey>", // Comments in Riot Channel
    WithdrawReasons: {
        _set: {
            TransactionPayment: 1,
            Transfer: 2,
            Reserve: 4,
            Fee: 8,
            Tip: 16,
        }
    },
    "LockIdentifier": "[u8; 8]", // Added for compatibility v1
    BalanceLockV1: {
        id: 'LockIdentifier',
        amount: 'Balance',
        until: 'BlockNumber',
        reasons: 'WithdrawReasons'
    },
    "BalanceLockV1<[u8; 8],u64,u64,i8>": "BalanceLockV1", // Added for compatibility v1
    // "Locks": "Vec<BalanceLockV1<Vec<u8>,u64,u64,i8>>", // Added for compatibility v1
    "AcceptAssignedStatus": "bool",
    "Account": "u64",
    "AccountOf": "Account",
    "AccountBalance": "i128",
    "AccountBalanceOf": "i128",
    "AccountBalanceOf<T>": "i128",
    "ApprovalStatus": "u16",
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
    "Indicator": "bool",
    "LedgerBalance": "i128",
    "LockStatus": "bool",
    "NumberOfBreaks": "u16",
    "NumberOfBlocks": "u64",
    "PostingPeriod": "u16",
    "PostingIndex": "u128",
    "ProjectHash": "Hash",
    "ProjectStatus": "u16",
    // "buyOrSell": "u16",
    // "amount": "i128",
    // "openClosed": "bool",
    // "orderType": "u16",
    // "deadline": "u64",
    // "dueDate": "u64",
    // "OrderSubHeader": {
    //     "buy_or_sell": "u16",
    //     "amount": "i128",
    //     "open_closed": "bool",
    //     "order_type": "u16",
    //     "deadline": "u64",
    //     "due_date": "u64"
    // },
    // "Product": "Hash",
    // "UnitPrice": "i128",
    // "Quantity": "u128",
    // "UnitOfMeasure": "u16",
    // "ItemDetailsStruct": {
    //     "Product": "Hash",
    //     "UnitPrice": "i128",
    //     "Quantity": "u128",
    //     "UnitOfMeasure": "u16"
    // },
    // "ItemDetailsStruct<Hash,i128,u128,u16>": "ItemDetailsStruct",
    // "OrderItem": "ItemDetailsStruct",
    "OrderStatus": "u16",
    "RandomHashedData": "Hash",
    "ReasonCode": "u16",
    "ReasonCodeType": "u16",
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

    /*
     * Order + Task related types
     */
    OrderHeader: {
        owner: 'AccountId',
        fulfiller: 'AccountId',
        approver: 'AccountId',
        orderStatus: 'u16',
        approvalStatus: 'u16',
        isSell: 'u16',
        amountXTX: 'i128',
        isMarket: 'bool',
        orderType: 'u16',
        deadline: 'u64',
        dueDate: 'u64',
    },
    'OrderHeader<AccountId,AccountId,AccountId,u16,u16,u16,i128,bool,u16,u64,u64>': 'OrderHeader',
    OrderItem: {
        product: 'Hash',
        unitPrice: 'i128',
        quantity: 'u128',
        unitOfMeasure: 'u16',
    },
    'OrderItem<Hash,i128,u128,u16>': 'OrderItem',
    TXKeysL: {
        recordId: 'Hash',
        parentId: 'Hash',
        bonsaiToken: 'Hash',
        txID: 'Hash',
    },
    'TXKeysL<Hash,Hash,Hash,Hash>': 'TXKeysL',
    TXKeysM: {
        recordId: 'Hash',
        bonsaiToken: 'Hash',
        txID: 'Hash',
    },
    'TXKeysM<Hash,Hash,Hash>': 'TXKeysM',
    TXKeysS: {
        bonsaiToken: 'Hash',
        txID: 'Hash',
    },
    'TXKeysS<Hash,Hash>': 'TXKeysS',
    TXKeysT: {
        txID: 'Hash',
    },
    'TXKeysT<Hash>': 'TXKeysT',

    // deperecated
    "ProjectHashRef": "H256",
}
