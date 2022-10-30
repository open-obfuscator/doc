+++
title       = "Arithmetic Obfuscation"
description = "This pass can be used to transform arithmetic operations into Mixed Boolean-Arithmetic expressions"
icon        = "fa-regular fa-calculator-simple"
img_compare = true
+++

{{< hicon lvl=1 icon="fa-regular fa-calculator-simple" >}}Arithmetic Obfuscation{{< /hicon >}}

{{< pass_purpose >}}
The purpose of this pass is to transform arithmetic operations into complex expressions.
{{< /pass_purpose >}}

{{< compare "svg/arithmetic-1.svg" "svg/arithmetic-2.svg" "omvll">}}

## When to use it?

Arithmetic operations (`+, -, ^, &, |, ...`) are usually compiled into an AArch64 instruction that
**exactly** matches the original operation[^opt].

For instance, when we compile this function in which the `xor` operation is considered sensitive,

```cpp
void encode(uint8_t* data, size_t len) {
  for (size_t i = 0; i < len; ++i) {
    data[i] = data[i] ^ 0x23;
  }
}
```

It results in this sequence of AArch64 instructions:

```armasm {hl_lines=4}
mov     w10, #35
...
ldrb    w11, [x9]
eor     w11, w11, w10
strb    w11, [x9], #1
```

From a reverse engineering perspective, the sensitive xor operation associated with the `EOR` instruction is
straightforward to identify.

Thus, if you consider that the arithmetic operations performed by your function are sensitive, you
should consider enabling this obfuscation pass.

As a result, when this obfuscation pass is enabled, the previous operation is transformed into a
more complex expression:

```cpp
// Transformation of data[i] = data[i] ^ 0x23;
uint32_t C = data[i];
int32_t  X = -(C & 0x23);
data[i] = ((C + (0xffffffdc | !C) + 0x24) ^ X) +
          (((C + (0xffffffdc | !C) + 0x24) & X) << 1);
```

## How to use it?

In the O-MVLL configuration file, you must define the following method in the Python class implementing `omvll.ObfuscationConfig`


```python
def obfuscate_arithmetic(self, mod: omvll.Module,
                               fun: omvll.Function) -> omvll.ArithmeticOpt:
    if func.name == "encode":
        # Explicitly define the number of iterations
        # applied on the arithmetic expressions
        return omvll.ArithmeticOpt(iterations=8)

    if mod.name.endswith("encrypt.cpp"):
        # Obfuscate with a number of iteration defined by O-MVLL
        return True

    return False
```

The `iteration` parameter defines the number of loops transforming the arithmetic operation:

```text
Operation : X ^ Y
#1 Loop   : (X | Y) - (X & Y)
#2 Loop   : (((Y + X) - (Y & X)) ^ ((Y | X) - (Y + X))) + 2*(((Y + X) - (Y & X)) & ((Y | X) - (Y + X)))
```
{{< alert type="danger" icon="fa-light fa-shield-slash" >}}
It is more than **highly recommended** to run this pass with at least **2 iterations**.

See the next section for the details
{{</ alert >}}

## Implementation

The transformation of the arithmetic operations works by iterating over all the instructions
of a basic block and selecting arithmetic operations (`+, -, ^, &, |`) that can be transformed with
a Mixed Boolean-Arithmetic expression:

```cpp
for (Instruction& I : BasicBlock) {
  auto* BinOp = dyn_cast<BinaryOperator>(&I);
  if (isSupported(*BinOp)) {
    // Process ...
  }
}
```

In the first stage, the processing of the operation consists in extracting and wrapping the arithmetic operation (e.g. `add`)
with a function.

For instance, let's consider this addition:

```cpp
int b = a + b;
```

After creating its wrapper, it becomes:

```cpp
int __omvll_add(int x, int y) {
  return x + y;
}
int b = __omvll_add(x, y);
```

*"Why doing such transformation and not directly replacing the addition with its MBA equivalent?"*

First, LLVM is able to simplify MBA as it is discussed in the next section: [Limitation & Attacks](#limitations--attacks).
One solution to prevent these optimizations is to create a function flagged with the attribute `OptimizeNone`,
which is roughly equivalent to:

```cpp {hl_lines=1}
__attribute__((optnone))
int __omvll_add(int x, int y) {
  return x + y;
}
```

{{< alert type="info" icon="fa-light fa-seal" >}}
As far I know, it does not exist an equivalent for basic blocks or instructions.
{{</ alert >}}

The second advantage of this call-transformation lies in the implementation of the iteration process.
If we perform the transformations on the arithmetic operations on the fly in the original basic block,
for each iteration, we must re-process all the other instructions of the basic block.

With a wrapper, it only requires applying the iterations on the isolated function, not on all the instructions
of the original basic block:

```cpp
__attribute__((optnone))
int __omvll_add(int x, int y) {
  E = x + y;
  for (size_t i = 0; i < NB_ITERATIONS; ++i) {
    E = MBA_add_xor_sub_or_and(E);
  }
}
```

Last but not least, we have to make sure that the wrapped function is inlined at the end of the processing
otherwise, it would be a weakness.

```cpp
Wrapper->addFnAttr(Attribute::AlwaysInline);
```

This LLVM inlining code is equivalent to:

```cpp {hl_lines=2}
__attribute__((optnone))
__attribute__((alwaysinline))
int __omvll_add(int x, int y) {
  E = x + y;
  for (size_t i = 0; i < NB_ITERATIONS; ++i) {
    E = MBA_add_xor_sub_or_and(E);
  }
}
```

Regarding the transformations themselves, they rely on the built-in LLVM pattern matcher:

```cpp
Instruction& I = ...;
Value *X, *Y;

// Match X & Y
if (!match(&I, m_And(m_Value(X), m_Value(Y)))) {
  return nullptr;
}
```

Upon a match <i class="fa-sharp fa-regular fa-shield-heart text-secondary"></i>, the instruction associated
with the operation is replaced with a Mixed Boolean-Arithmetic expression (MBA):

```cpp
// (X + Y) - (X | Y)
return BinaryOperator::CreateSub(
    Builder.CreateAdd(X, Y),
    Builder.CreateOr(X, Y)
);
```

The overall structure of the *transformer* is highly inspired by the [InstCombine](https://github.com/llvm/llvm-project/tree/17f2ee804a3c50f0b50d57a0100ce9f4102bfa3f/llvm/lib/Transforms/InstCombine) pass
and the MBA used in this pass are taken from [sspam](https://github.com/quarkslab/sspam/blob/6784e1c06157c6984ef04b67382e584d4b5316e0/sspam/simplifier.py#L30-L53)
developed by Ninon Eyrolles:

| Operation    | MBA Transformation       |
|--------------|--------------------------|
| `X ^ Y`      | `(X \| Y) - (X & Y)`     |
| `X + Y`      | `(X & Y) + (X \| Y)`     |
| `X - Y`      | `(X ^ -Y) + 2*(X & -Y)`  |
| `X & Y`      | `(X + Y) - (X \| Y)`     |
| `X \| Y`     | `X + Y + 1 + (~X \| ~Y)` |


## Limitations & Attacks

First and foremost, LLVM is able to *simplify* MBA as we can see in the file
`llvm/lib/Transforms/InstCombineAndOrXor.cpp`

```cpp
...
// (A ^ B) ^ (A | C) --> (~A & C) ^ B -- There are 4 commuted variants.
if (match(&I, m_c_Xor(m_OneUse(m_Xor(m_Value(A), m_Value(B))),
                      m_OneUse(m_c_Or(m_Deferred(A), m_Value(C))))))
    return BinaryOperator::CreateXor(
        Builder.CreateAnd(Builder.CreateNot(A), C), B);

// (A ^ B) ^ (B | C) --> (~B & C) ^ A -- There are 4 commuted variants.
if (match(&I, m_c_Xor(m_OneUse(m_Xor(m_Value(A), m_Value(B))),
                      m_OneUse(m_c_Or(m_Deferred(B), m_Value(C))))))
    return BinaryOperator::CreateXor(
        Builder.CreateAnd(Builder.CreateNot(B), C), A);

// (A & B) ^ (A ^ B) -> (A | B)
if (match(Op0, m_And(m_Value(A), m_Value(B))) &&
    match(Op1, m_c_Xor(m_Specific(A), m_Specific(B))))
  return BinaryOperator::CreateOr(A, B);
// (A ^ B) ^ (A & B) -> (A | B)
if (match(Op0, m_Xor(m_Value(A), m_Value(B))) &&
    match(Op1, m_c_And(m_Specific(A), m_Specific(B))))
  return BinaryOperator::CreateOr(A, B);
...
```

Hence, we must be careful to not trigger these simplifications (c.f. [Implementation](#implementation))

Second, the MBA currently used in this pass are:

1. Fixed and statically encoded.
2. Simplified by the LLVM optimization pipeline if misconfigured.
3. Can be simplified with existing public tools once extracted.

For the third point, [msynth](https://github.com/mrphrazer/msynth) or [Triton](https://triton-library.github.io/)
could be used to verify if the expressions are simplified.

Nevertheless, **automatically** identifying **AND** extracting MBAs from a compiled binary is not trivial
so we can consider that this pass introduces a non-negligible overhead for the reverse engineers.

For these reasons and, in its current form, this pass should be considered as a *cosmetic protection* rather
than a state-of-the-art protection.

## References

{{< include-references "references.yml" >}}

[^opt]: The compiler might also optimize the operation into instructions that are equivalent but
        less meaningful from a reverse engineering perspective. For instance, `x % 8` is usually transformed in `x & 7`.
        [Hacker's Delight](https://www.oreilly.com/library/view/hackers-delight-second/9780133084993/) is a good
        reference for this kind of transformation.

