import {DMMF} from '@prisma/generator-helper';
import {Config} from '../generateGraphqlSchema';

enum SDL {
  ID = 'ID',
  Int = 'Int',
  Float = 'Float',
  String = 'String',
  Boolean = 'Boolean',
}

enum PSL {
  Int = 'Int',
  Float = 'Float',
  String = 'String',
  BigInt = 'BigInt',
  Boolean = 'Boolean',
  Decimal = 'Decimal',
  DateTime = 'DateTime',
  Json = 'Json',
  Bytes = 'Bytes',
  Unsupported = 'Unsupported',
}

enum Scalar {
  ByteArray = 'ByteArray',
  DateTime = 'DateTime',
}

enum ReservedName {
  Query = 'Query',
  Mutation = 'Mutation',
}

enum Definition {
  type = 'type',
  enum = 'enum',
  input = 'input',
}

type Rule = {
  matcher: (
    field: DMMF.Field,
    model: DMMF.Model,
    // This indicates when Model field is being processed
    isModelsOfSchema?: boolean,
    config?: Config,
  ) => boolean;
  transformer: (field: DMMF.Field) => DMMF.Field;
};

type CustomRules = {
  beforeAddingTypeModifiers?: Rule[];
  afterAddingTypeModifiers?: Rule[];
};
type ArgConfig = {
  // Models names that should be generated
  models: string[];
  // Fields that should be generated
  fields: string[];
};
export type {Rule, CustomRules, ArgConfig};

export {SDL, PSL, Scalar, ReservedName, Definition};
