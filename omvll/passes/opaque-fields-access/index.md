+++
title       = "Opaque Fields Access"
description = "This pass can be used to obfuscate structure fields accesses"
icon        = "fa-regular fa-arrow-right"
img_compare = true
+++

{{< hicon lvl=1 icon="fa-regular fa-arrow-right" >}}Opaque Fields Access{{< /hicon >}}

{{< pass_purpose >}}
The purpose of the pass is to obfuscate the access of structure's fields.
{{< /pass_purpose >}}

{{< compare "svg/opaque-field-1.svg" "svg/opaque-field-2.svg" "omvll">}}


As mentioned in a talk by R. Rolles about [*Automation Techniques in C++ Reverse Engineering*](https://static1.squarespace.com/static/53a64cc2e4b0c63fc41a3320/t/5d48d619208ae80001a24efc/1565054491140/CPP+Dynamic+Type+Recovery.pdf),
reverse engineers spend a non-negligible amount of time to identify structures and their attributes:

{{< blockquote who="Rolf Rolles" where="Automation Techniques in C++ Reverse Engineering">}}
In summary, I noticed that when I reverse engineer C++ programs, I spend almost all of my time recreating
structures, applying structure offsets in the disassembly listing, and applying structure types to Hex-Rays variables and function arguments
{{< / blockquote >}}

And I completely agree!

To better understand how structures are involved in reverse engineering, let's consider the following code
which involves a JNI function:

```cpp
class SecretString {
  public:
  SecretString(const char* input) : value_(input) {}
  bool check() {
    checked_ = (value_ == "OMVLL");
    return checked_;
  }
  private:
  bool checked_ = false;
  std::string value_;
};

bool check_jni_password(JNIEnv* env, jstring passwd) {
  const char* pass = env->GetStringUTFChars(passwd, nullptr);
  SecretString secret(pass);
  return secret.check();
}
```

When this code is compiled, `env->GetStringUTFChars()` is called through:

1. An access to the `GetStringUTFChars` pointer in the `JNIEnv` structure.
2. A call on the dereferenced pointer.

In assembly it looks like this:

```armasm
ldr    x8, [x8, #1352] ; 1352 is the offset of GetStringUTFChars
blr    x8              ; in the JNIEnv structure
```

{{< alert type="info" icon="fa-sharp fa-light fa-table-tree" >}}
This pattern is also very similar to C++ vtable accesses.
{{< /alert >}}

When decompiling the `check_jni_password` function, we can effectively observe this offset, and
most of the disassemblers can also resolve the structure's attribute, once the user has resolved and provided
its type:

{{< img-diff "./img/ida-after.webp" "./img/ida-before.webp" "omvll" "Output of the decompilation when the user has reversed the types">}}

Similarly, once we have identified and reversed the layout of the `SecretString* this` pointer,
the `SecretString::check` function is a bit more meaningful:

{{< img-diff "./img/ida-check-after.webp" "./img/ida-check-before.webp" "omvll" >}}

{{< alert type="warning" icon="fa-regular fa-code" >}}
The inlined `std::string` structure is still a bit confusing since the beginning of the previous code is related
to the optimization performed by the STL for small strings.
{{< /alert >}}

On the other hand, when using this pass on the structures `JNIEnv` and `SecretString`, the output of the decompilation
is confusing even if, we manually define the type of the registers associated with `JNIEnv` and
`SecretString`.

The following figures show the differences in BinaryNinja and the output of IDA is very close:

{{< img-diff "./img/bn-jni.webp" "./img/bn-jni-obf.webp" "omvll" "check_jni_password() before and after the obfuscation" >}}

{{< img-diff "./img/bn-check.webp" "./img/bn-check-obf.webp" "omvll" "Section of SecretString::check() before and after the obfuscation" >}}

## When to use it?

You should trigger this pass on structures that aim at containing sensitive information. It might be
also worth enabling this pass on the `JNIEnv` structure for JNI functions involves in sensitive computations.

## How to use it?

You can trigger this pass by defining the method `obfuscate_struct_access` in the configuration class file:

```python
def obfuscate_struct_access(self, _: omvll.Module, __: omvll.Function,
                                  struct: omvll.Struct):
  if struct.name.endswith("JNINativeInterface"):
      return True
  if struct.name == "class.SecretString":
      return True
  return False
```

**In the current version**, O-MVLL expects a boolean value but futures versions should also be able to
accept an option on the access type (read or write). For instance:

```python
if struct.name == "class.SecretString":
    return omvll.StructAccessOpt(read=True, write=False)
```

## Implementation

This pass works with a first stage which consists in identifying the LLVM instructions: `llvm::LoadInst` and
`llvm::StoreInst`.

Then, there is a processing of the operands for these instructions, to check if they are
used to access the content of a structure or an element of a global variable.
In such a case, it resolves the name of the structure or the name of the global variable and calls the user-defined callback
to determine whether the access should be obfuscated.

Upon positive feedback from the user's callback, O-MVLL transforms the access from
this:

```armasm
ldr x0, [x1, #offset];
```

Into that:


```armasm
$var := #offset + 0;
ldr x0, [x1, $var];
```

Without any additional layer of protection, `$var := #offset + 0;` can be folded by the compiler
which would result in the original instruction.
To prevent this simplification, the instruction  `#offset + 0` is annotated[^annotation_info] to automatically
apply [Opaque Constants]({{< ref "/omvll/passes/opaque-constants">}}) and
      [Arithmetic Obfuscation]({{< ref "/omvll/passes/arithmetic" >}}) on this instructions:

{{< highlight cpp "hl_lines=8" >}}
IRBuilder<NoFolder> IRB(&Load);

Value* opaqueOffset =
  IRB.CreateAdd(ConstantInt::get(IRB.getInt32Ty(), 0),
                ConstantInt::get(IRB.getInt32Ty(), ComputedOffset));

if (auto* OpAdd = dyn_cast<Instruction>(opaqueOffset)) {
  addMetadata(*OpAdd, {MetaObf(OPAQUE_CST), MetaObf(OPAQUE_OP, 2llu)});
}
{{< /highlight >}}

## Limitations

This pass would not resist against the *Dynamic Structure Reconstruction* technique presented by R. Rolles
in the presentation mentioned in the introduction.

Nevertheless, it would require to use an AArch64 DBI which does not exist yet[^qbdi].

## References

{{< include-references "references.yml" >}}

[^annotation_info]: See the section [Annotations]({{< ref "/omvll/other-topics/annotations">}}) for the details.
[^qbdi]: I personally worked on this support in Quarkslab's [QBDI](https://qbdi.quarkslab.com/) but since I
         left the company this support is owned by [Quarkslab](https://www.quarkslab.com).
         It might be published by Quarkslab though.
