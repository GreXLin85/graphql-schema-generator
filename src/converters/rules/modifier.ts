import {DMMF} from '@prisma/generator-helper';
import {removeBracketsOrExclamations} from '../../utils';
import {Rule} from '../types';

const addBrasket = (field: DMMF.Field): DMMF.Field => {
  const {type} = field;

  return {...field, type: `[${type}]`};
};

const addExclamation = (field: DMMF.Field): DMMF.Field => {
  const {type} = field;

  return {...field, type: `${type}!`};
};

const rules: Rule[] = [
  {
    matcher: (field) => {
      const {isList, isRequired} = field;

      if (isList) {
        console.assert(isRequired);
      }

      return isList;
    },
    transformer: (field) => {
      return [addExclamation, addBrasket, addExclamation].reduce(
        (acc, cur) => cur(acc),
        field,
      );
    },
  },
  {
    matcher: (field) => {
      const {isList, isRequired} = field;

      return !isList && isRequired;
    },
    transformer: (field) => addExclamation(field),
  },
  {
    matcher: (field, model, isModelsOfSchema, config) => {
      const typeName = removeBracketsOrExclamations(field.type as string);
      if (
        typeof isModelsOfSchema === 'boolean' &&
        isModelsOfSchema &&
        config?.argConfig?.fields &&
        config.argConfig.models.includes(typeName)
      ) {
        return !!config.argConfig.fields.includes(field.name);
      }
      return false;
    },
    transformer: (field) => {
      return {
        ...field,
        name: `${field.name}(where:${removeBracketsOrExclamations(
          field.type as string,
        )}WhereInput)`,
      };
    },
  },
];

export default rules;
