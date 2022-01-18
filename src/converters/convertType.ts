import {DMMF} from '@prisma/generator-helper';

import type {Config} from '../generateGraphqlSchema';

import convertScalar from './convertScalar';

const convertType = (
  field: DMMF.Field,
  model: DMMF.Model,
  config?: Config,
  isModelsOfSchema = false,
): DMMF.Field => {
  const {kind} = field;

  if (kind === 'scalar' || config?.customRules) {
    return convertScalar(field, model, config, isModelsOfSchema);
  }

  // TODO
  return field;
};

export default convertType;
