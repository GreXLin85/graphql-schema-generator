import {DMMF} from '@prisma/generator-helper';

import type {Rule} from './types';
import existingRules from './rules/scalar';

import type {Config} from '../generateGraphqlSchema';

const convertScalar = (
  initialField: DMMF.Field,
  model: DMMF.Model,
  config?: Config,
  isModelsOfSchema = false,
): DMMF.Field => {
  const rules = [
    ...existingRules,
    ...(config?.customRules?.beforeAddingTypeModifiers || []),
  ];

  const newField = rules.reduce(
    (field, {matcher, transformer}: Rule): DMMF.Field => {
      if (matcher(field, model, isModelsOfSchema, config)) {
        return transformer(field);
      }

      return field;
    },
    initialField,
  );

  return newField;
};

export default convertScalar;
