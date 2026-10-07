// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IPRegistry {

    // The original registration timestamp is preserved after ownership transfers.
    struct IPRecord {
        address owner;
        uint256 registeredAt;
        bool exists;
    }

    mapping(bytes32 => IPRecord) private ipRecords;

    event IPRegistered(
        bytes32 indexed documentHash,
        address indexed owner,
        uint256 timestamp
    );

    event OwnershipTransferred(
        bytes32 indexed documentHash,
        address indexed previousOwner,
        address indexed newOwner
    );

    modifier onlyIPOwner(bytes32 _documentHash) {
        require(
            ipRecords[_documentHash].owner == msg.sender,
            "IPRegistry: caller is not the IP owner"
        );
        _;
    }

    // bytes32(0) would silently create a record at the null key
    modifier validHash(bytes32 _documentHash) {
        require(
            _documentHash != bytes32(0),
            "IPRegistry: document hash cannot be empty"
        );
        _;
    }

    function registerIP(bytes32 _documentHash)
        external
        validHash(_documentHash)
    {
        require(
            !ipRecords[_documentHash].exists,
            "IPRegistry: document hash already registered"
        );

        ipRecords[_documentHash] = IPRecord({
            owner: msg.sender,
            registeredAt: block.timestamp,
            exists: true
        });

        emit IPRegistered(_documentHash, msg.sender, block.timestamp);
    }

    function verifyIP(bytes32 _documentHash)
        external
        view
        validHash(_documentHash)
        returns (address owner, uint256 registeredAt, bool exists)
    {
        IPRecord storage record = ipRecords[_documentHash];
        return (record.owner, record.registeredAt, record.exists);
    }

    function transferOwnership(bytes32 _documentHash, address _newOwner)
        external
        validHash(_documentHash)
        onlyIPOwner(_documentHash)
    {
        require(
            ipRecords[_documentHash].exists,
            "IPRegistry: document hash not registered"
        );
        require(
            _newOwner != address(0),
            "IPRegistry: new owner cannot be the zero address"
        );
        require(
            _newOwner != msg.sender,
            "IPRegistry: new owner is already the current owner"
        );

        address previousOwner = ipRecords[_documentHash].owner;
        ipRecords[_documentHash].owner = _newOwner;

        emit OwnershipTransferred(_documentHash, previousOwner, _newOwner);
    }
}
