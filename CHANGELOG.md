# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-10-23

### Added
- **Full Type Inference System**: Complete TypeScript type safety for database operations
  - New `defineSchema()` helper function that eliminates the need for `as const` assertions
  - Generic `Database<TSchema>` class that provides fully typed table instances
  - Comprehensive type inference utilities in `src/types/infer.ts`:
    - `InferTableType`: Infers TypeScript types from schema definitions
    - `InferDatabaseTables`: Maps all table names to their inferred types
    - `InsertType`: Makes auto-increment primary keys optional based on schema metadata
    - `ExpandRecursively`: Utility type that preserves built-in types (Date, Blob, etc.)
  - New `typed-schema-demo.ts` example demonstrating full type safety
  - All CRUD operations are now type-checked at compile time
  - Type-safe select and where clause operations

### Changed
- Database class is now generic (`Database<TSchema>`) to support typed instances
- Table operations now return fully typed results based on schema definitions

## [0.2.0] - 2025-10-01

### Added
- **Blob Storage Support**: Comprehensive support for storing and managing binary data (Files, Blobs)
  - New `blob` field type in schema definitions
  - `insertWithBlob()`, `updateBlob()`, `getBlobUrl()`, and `getBlobMetadata()` methods on Table
  - Blob-specific query operators: `sizeGt`, `sizeLt`, `sizeBetween`, `mimeType`
  - Enhanced reliability for blob storage operations

### Fixed
- Updated repository URL format for npm provenance verification

### Documentation
- Added comprehensive JSDoc documentation throughout the API

## [0.1.3] - 2025-10-01

### Added
- **Query System Enhancements**:
  - New `inArray()` operator for IN queries (recommended replacement for `in_`)
  - Comprehensive test coverage for all query operators
  - Enhanced query builder documentation

### Changed
- **Deprecated Operators**:
  - `in_` operator deprecated in favor of `inArray` for better developer experience
  - `notIn` operator deprecated in favor of composable `not(inArray(...))` pattern

### Documentation
- Added comprehensive JSDoc documentation to QueryBuilder and QueryExecutor
- Added extensive JSDoc documentation for all query operators

### Maintenance
- Linting improvements and code quality enhancements

## [0.1.2] - 2025-09-29

### Fixed
- Fixed JSR.json synchronization after version updates
- Ensured version consistency across package files

### Documentation
- Enhanced JSDoc documentation for JSR (JavaScript Registry) compliance
- Improved API documentation quality

## [0.1.1] - 2025-09-29

### Added
- Initial public release
- Core database connection and transaction management
- SQL-like query builder with chainable interface
- Schema validation and data integrity
- Enterprise-grade migration system with rollback support
- Type-safe TypeScript interfaces throughout
- Tree-shaking optimized build (~14KB gzipped)
- Comprehensive test suite with fake-indexeddb

### Features
- **Database Management**: Connection lifecycle, schema validation, version management
- **Query System**: SQL-like operators (eq, gt, gte, lt, lte, between, in_, not, and, or)
- **Transaction Management**: Promise-based API with automatic lifecycle handling
- **Migration System**: Automatic schema evolution, dry-run validation, rollback support
- **Type Safety**: Full TypeScript support with strict type checking

[0.2.0]: https://github.com/AhamSammich/dexbee-js/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/AhamSammich/dexbee-js/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/AhamSammich/dexbee-js/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/AhamSammich/dexbee-js/releases/tag/v0.1.1
