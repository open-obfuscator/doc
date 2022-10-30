+++
title       = "Arithmetic Obfuscation"
description = "This pass transforms arithmetic operations into complex expressions."
icon        = "fa-regular fa-calculator-simple"
img_compare = true
+++

{{< hicon lvl=1 icon="fa-regular fa-calculator-simple" >}}Arithmetic Obfuscation{{< /hicon >}}

{{< pass_purpose >}}
The purpose of this pass is to transform arithmetic operations into complex expressions.
{{< /pass_purpose >}}

{{< compare "svg/arithmetic-2.svg" "svg/arithmetic-1.svg" "dprotect">}}

Because of the design of the Java bytecode, arithmetic operations are (usually) exactly translated in their dedicated
bytecode.

For instance, if we consider the following Java code:

```java
int doAdd(int a, int b) {
  return a + b;
}
```

Once compiled, it generates the following instructions:

```java
int doAdd(int, int) {
  Code:
     0: iload_1
     1: iload_2
     2: iadd
     3: ireturn
}
```

Moreover, the Java arithmetic opcodes are strongly typed:

- `iadd` for integer number addition.
- `ladd` for long number addition.
- `fadd` for floating numbers addition.
- `dadd` for double numbers addition.

It means that decompilers can reliably determine the type of the arithmetic operands and efficiently
decompile arithmetic expressions.

In addition, decompilers are doing simplifications on the top of these expressions (like constant propagation).

Similarly to the [Arithmetic Obfuscation]({{< ref "/omvll/passes/arithmetic" >}}) in O-MVLL, this pass transforms
arithmetic operations into Mixed Boolean-Arithmetic expressions (MBA).

## When to use it?

You should use this protection when arithmetic operations matter in the logic of your class.
This is particularly true for:

- Cryptography algorithms (known or custom).
- Encoding algorithms.
- Bitwise manipulations.

{{< alert type="danger" icon="fa-thin fa-bell-exclamation">}}
Some operations on float/double and arrays are not supported yet.
Hence, be aware of the [limitations](#limitations).
{{< /alert >}}

## How to use it?

Within the dProtect configuration file, we can enable this protection with:

```bash
-obfuscate-arithmetic <class specifier>
```

In addition, this `-obfuscate-arithmetic` option accepts the following modifiers:

```bash
-obfuscate-arithmetic,low    <class specifier>
-obfuscate-arithmetic,medium <class specifier>
-obfuscate-arithmetic,high   <class specifier>
```

`low, medium, and high` define the number of transformations applied to a single operation:

```python
[->] Operation:  X ^ Y [<-]

low    : (X | Y) - (X & Y)
medium : (((Y + X) - (Y & X)) ^ ((Y | X) - (Y + X))) + 2*(((Y + X) - (Y & X)) & ((Y | X) - (Y + X)))
high   : <not printable>
```

| Level    | Number of Iterations |
|----------|----------------------|
| `low`    | 1                    |
| `medium` | 2                    |
| `high`   | 3                    |


In the future, `-obfuscate-arithmetic` might also accept other modifiers to disable/enable this obfuscation
on categories of instructions:

```bash
-obfuscate-arithmetic,skiparray <class specifier>
-obfuscate-arithmetic,skipfloat <class specifier>
```

Nevertheless, the support of these extra modifiers will require some changes in the design of the pass.

## Implementation

To transform arithmetic operations into Mixed Boolean-Arithmetic expressions (MBA), the pass implements the
`proguard.obfuscate.util.ReplacementSequences` interface which provides the API to define rewriting rules:

```java
import proguard.obfuscate.util.ReplacementSequences;

public class MBAObfuscationAdd implements ReplacementSequences {
  ...

  @Override
  public Instruction[][][] getSequences() {
    return new Instruction[][][]
      {
        // X + Y --> (X & Y) + (X | Y)
        {
          // Sequence of instructions to match
          ____.iload(X)       // |
              .iload(Y)       // |
              .iadd()         // | X + Y
              .__(),          // |

          // Transformation
          ____.iload(X)       // | First term
              .iload(Y)       // |
              .iand()         // | X & Y

              .iload(X)       // | Second term
              .iload(Y)       // |
              .ior()          // | X | Y

              .iadd()         // | Addition of the previous terms
              .__(),          // | (X & Y) + (X | Y)
```

Given the different rewriting classes associated with arithmetic operations, they are successively
applied on the class pool using the Proguard `MultiMemberVisitor` visitor:

```java {hl_lines="6-10"}
programClassPool.accept(
  new AllClassVisitor(
  new MBAObfuscationFilter(
  new AllMethodVisitor(
  new MultiMemberVisitor(
      new InstructionSequenceObfuscator(new MBAObfuscationAdd(...)),
      new InstructionSequenceObfuscator(new MBAObfuscationXor(...)),
      new InstructionSequenceObfuscator(new MBAObfuscationAnd(...)),
      new InstructionSequenceObfuscator(new MBAObfuscationOr (...)),
      new InstructionSequenceObfuscator(new MBAObfuscationSub(...))
  )))));
```

{{< admonition color="info" >}}
To limit the number of rewriting rules, the pass performs an early normalization of the instructions.
This normalization is implemented by the `MBANormalizer` visitor.
{{< /admonition >}}


## Limitations

Classical arithmetic operations on **integers** and **longs** are **supported** by the pass. Nevertheless,
the pass **does not (yet) support** expressions with inner operations in the **left and right operands**:

```java
int A = B + C;                // Supported
int A = (B >> 3) + (C << 4);  // /!\ Addition not supported
int A = (B & 0xFF) + (C | 1); // /!\ Addition not supported
```

In addition, the operations on **floats** and **doubles** are **not yet supported** but following the existing
rules on integers/long, it should not be complicated to support.

For array operations (e.g. `table[i] + table[y]`), there is early support but it is far from being complete.
