---
title: Using TypeScript's Mapped and Conditional Types
layout: post
tags: [blog, typescript, conditional types, mapped types, validation]
---

# {{ page.title }}

In this post I will demonstrate how to use TypeScript's [mapped](https://www.typescriptlang.org/docs/handbook/advanced-types.html#mapped-types) and [conditional](https://www.typescriptlang.org/docs/handbook/advanced-types.html#conditional-types) types to enforce defining [@hapi/joi](https://hapi.dev/module/joi/) validations corresponding to TypeScript's types.

This post demonstrates how to apply mapped and conditional types in practise, but not necessarily the best way to define validations.
I gave a [talk]({% post_url 2019-11-21-typescript-mapped-and-conditional-types-copenhagenjs %}) on the same topic.
Check it out if you prefer consuming information as video/audio over text.

## The Problem

TypeScript does not give any runtime type guarantees, and thus it can easily happen for a runtime value to differ from the type we specified for it.
One way to bridge this gap is to validate inputs<label for="sn-parse-validate" class="margin-toggle sidenote-number"></label>
<input type="checkbox" id="sn-parse-validate" class="margin-toggle"/>
<span class="sidenote" id="sn-parse-validate">On this topic, check out Alexis King's blogpost [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/).</span>
on the system boundary and ensure that the validated values correspond to their specified types.

However, when the validation definition is independent of the underlying type, we have no guarantee that the validations stay true to the type as the codebase evolves.
Take the following example where the specified type and validation rules differ.

```typescript
import * as joi from '@hapi/joi'

type Article = {
  title: string
  content: string
}

const ArticleSchema = joi.object({
  title: joi.number(),
})

const processArticle = async (article: Article): Promise<void> => {
  const validatedArticle = await ArticleSchema.validateAsync(article)
  // use validatedArticle
}
```

The defined schema has two issues<label for="sn-large-codebase" class="margin-toggle sidenote-number"></label>
<input type="checkbox" id="sn-large-codebase" class="margin-toggle"/>
<span class="sidenote" id="sn-large-codebase">It is easy to spot issues in an example of this size, but not necessarily in a codebase of larger size. Especially if validations are defined in a different place than the type.</span>:

1. It does not define validation for the `content` property.
1. The type declaration declares `title` to be of type `string`, but the validation says that it has to be a `number`.

## The Remedy

The remedy is to make a compile-time link between the underlying type and its validations. A link which:
1. Checks that validations are defined for each property.
1. Checks that validation rules correspond to the underlying type.
1. Triggers a compile-time error if either of the checks fail.

To put it into TypeScript terms, we want to define a generic type `ValidationSchema<T>` which will ensure that any value of type `ValidationSchema<T>` defines validations for the generic object `T`. In the following example:

```typescript
// Define the validation type
type ValidationSchema<T> = {
  // todo
}

type Article = {
  title: string
  content: string
}

const WrongArticleValidations: ValidationSchema<Article> = {
  title: joi.string(),
}

const CorrectArticleValidations: ValidationSchema<Article> = {
  title: joi.string(),
  content: joi.string(),
}
```

we should get a compilation error for `WrongArticleValidations` because it does not specify validation for property `content`.

## Defining Validation for Each Property

Mapped types allow us to map over the properties of a type and:
- assign a common type to all properties or transform the original type
- ensure that each property is readonly/required/optional

As such, we can define a mapped type `ValidationSchema1<T>` which maps over the properties of its parameter `T` and which:
- enumerates all properties of `T`
- makes all properties required (so we don't forget to specify properties optional in `T`)
- requires each property to be a validation (of type `Schema` from `@hapi/joi`)

Lo and behold:

```typescript
import { Schema } from '@hapi/joi'

type ValidationSchema1<T> = {
  [PropertyName in keyof T]-?: Schema
}
```

Using this type prevents us from omitting a validation, but does not ensure that we define a validation of correct type.
For that we have to use conditional types.

## Defining Validations of Correct Type

As mapped types helped us ensure that we define validations for each and every property of a type, conditional types will help us ensure that we define validations of appropriate type.
That is, we define a number validation for a number, a string validation for a string and so on.

Conditional types resolve to a different type, based on a type-level condition.
We can then define a conditional `PropertySchema<T>` type resolving to different types, based on the type of its parameter. Lo and behold:

```typescript
import { BooleanSchema, StringSchema } from '@hapi/joi' 

type PropertySchema<PropertyType> =
  PropertyType extends boolean ? BooleanSchema :
  PropertyType extends string ? StringSchema :
  // ...
  never
```

## The Result

We can now combine the two types into the final `ValidationSchema<T>` type which implements the required functionality. 

```typescript
import {
  ArraySchema, BooleanSchema, NumberSchema,
  ObjectSchema, StringSchema, SymbolSchema
} from '@hapi/joi'

type PropertySchema<PropertyType> =
  PropertyType extends boolean ? BooleanSchema :
  PropertyType extends string ? StringSchema :
  PropertyType extends number ? NumberSchema :
  PropertyType extends symbol ? SymbolSchema :
  PropertyType extends ArrayLike<any> ? ArraySchema :
  PropertyType extends Record<string, any> ? ValidationSchema<PropertyType> :
  never

type ValidationSchema<T extends Record<string, any>> = {
  [PropertyName in keyof T]-?: PropertySchema<T[PropertyName]>
}
```

You can find this code on [GitHub](https://github.com/pavelkucera/pavelkucera.github.io/blob/master/assets/posts/using-typescripts-mapped-and-conditional-types/code.ts) and you can jump right into using it with `@hapi/joi`.
