+++
title       = "Constants Obfuscation"
description = "This pass obfuscates constants present in Java/Kotlin classes."
icon        = "fa-regular fa-input-numeric"
img_compare = true
+++

{{< hicon lvl=1 icon="fa-regular fa-input-numeric" >}}Constants Obfuscation{{< /hicon >}}

{{< pass_purpose >}}
The purpose of this pass is to hide the constants used in Java/Kotlin classes.
{{< /pass_purpose >}}

{{< compare "svg/constants-1.svg" "svg/constants-2.svg" "dprotect">}}

As for [native code]({{< ref "/omvll/passes/opaque-constants" >}}), the constants used in a Java class can
provide hints for the reverse engineers about the purpose of the class.

This pass can be used to hide constants by masking them in a table.

If we consider the initialization of a ChaCha block in which the first four entries are initialized with `"expand 32-byte k"`:

```java {hl_lines="1-4"}
this.matrix[ 0] = 0x61707865;
this.matrix[ 1] = 0x3320646e;
this.matrix[ 2] = 0x79622d32;
this.matrix[ 3] = 0x6b206574;
```

After applying this pass, the initialization looks like this:

```java {hl_lines="10-13"}
ChaCha20.a[ 0] = 0x2262775c;
ChaCha20.a[ 2] = 0x2fd5c988;
ChaCha20.a[ 4] = 0x093052e7;
ChaCha20.a[ 9] = 0x6b6cbd0a;
ChaCha20.a[10] = 0x79ec4b16;
ChaCha20.a[11] = 0x48c2f323;
ChaCha20.a[12] = 0x535be40d;
ChaCha20.a[13] = 0x5870b603;
...
this.matrix[ChaCha20.a[9] ^ 0x6B6CBD0A] = a[10] ^ 0x189C3373;
this.matrix[ChaCha20.a[0] ^ 0x2262775D] = a[11] ^ 0x7BE2974D;
this.matrix[ChaCha20.a[2] ^ 0x2FD5C98A] = a[12] ^ 0x2A39C93F;
this.matrix[ChaCha20.a[4] ^ 0x093052E4] = a[13] ^ 0x3350D377;
```

The `ChaCha20.a[]` array holds the **masked** constants and the original `matrix` accesses are
replaced with a lookup to the `ChaCha20.a[]` array.

## When to use it?

You should enable this pass when you have (hard-coded) constants that are involved in sensitive computations.

## How to use it?

Within the dProtect configuration file we can enable this protection through:

```bash
-obfuscate-constants <class specifier>
```

In addition, it is highly recommended to combine this pass with
[Arithmetic Obfuscation]({{< ref "/dprotect/passes/arithmetic" >}})
as constants are usually associated with an arithmetic computation.


## Implementation

In its current form, this obfuscation pass works by tabulating the constants and by masking them with
a xor.

Programmatically, the pass implements a Proguard `ClassVisitor` that is used to add the static
`OPAQUE_CONSTANTS_ARRAY` attribute:

```java
@Override
public void visitProgramClass(ProgramClass programClass) {
  ClassBuilder classBuilder = new ClassBuilder(programClass);
  classBuilder.addAndReturnField(AccessConstants.PRIVATE |
                                 AccessConstants.STATIC,
                                 "OPAQUE_CONSTANTS_ARRAY", "[J");
}
```

`OPAQUE_CONSTANTS_ARRAY` is a `long[]` array that is used to store the masked constants collected by pass.
The collection of the constants is performed with the combination of an `InstructionVisitor` and
a `ConstantVisitor`.

Let's consider the protection of `iconst_3` (pushing 3 onto the stack).

This instruction can be visited tanks to the `InstructionVisitor.visitSimpleInstruction()` overloaded method:

```java {hl_lines=5}
@Override
public void visitSimpleInstruction(..., SimpleInstruction instruction) {
  switch (instruction.opcode) {
    case Instruction.OP_ICONST_3: {
    // Processing
    }
}
```

The pass processes the value 3 associated with this instruction, by inserting (if not already present) the constant
in an internal array of the pass:

```java
// Processing
int value = instruction.constant;
int index = getOrInsert((long)value);
```

When inserting the value, the pass also generates a random *key* that is used to mask the original constant:

```java {hl_lines=4}
// Processing
int value = instruction.constant;
int index = getOrInsert((long)value);
Long key  = keys.get(value); // Masking Key associated with the constants value
```

Then, the pass replaces the original `iconst_3` with a lookup into the `OPAQUE_CONSTANTS_ARRAY`:

```java
// Equivalent to OPAQUE_CONSTANTS_ARRAY[index] ^ key
____.getstatic("OPAQUE_CONSTANTS_ARRAY")
    .ldc(index)
    .laload()
    .l2i()
    .ldc(key.intValue())
    .ixor()
    .__());
```

On the other hand, the `OPAQUE_CONSTANTS_ARRAY` is filled with the (masked) constants by updating
the `static { }` constructor of the class:

```java
new InitializerEditor().addStaticInitializerInstructions(
____ -> {
  // Equivalent to new long[constants.size()]
  ____.ldc(constants.size())
      .newarray(Instruction.ARRAY_T_LONG)
      .putstatic(programClass, arrayField);

  // Push the constans
  for (int i = 0; i < constants.size(); ++i) {
      Long value   = constants.get(i);
      Long key     = keys.get(value);
      Long encoded = value ^ key;
      ____.getstatic(programClass, arrayField)
          .sipush(i)
          .ldc2_w(encoded)
          .lastore();
  }
});
```

## Limitations

First, this pass does handle (yet) double or float constants. In addition, the constants targeted by this
pass are **ALWAYS** masked with a xor operation which could be improved by using random arithmetic-based masking.

This pass is also unlikely resilient against a Jadx plugin or a Proguard-based deobfuscation pass that would
identify the `OPAQUE_CONSTANTS_ARRAY` attribute and the instructions that use it.

JEB Decompiler also published a blog post about how this protection can be defeated: [*Reversing dProtect*](https://www.pnfsoftware.com/blog/reversing-dprotect/).

{{< include-references "references.yml" >}}

