+++
title       = "Strings Encoding"
description = "This pass can be used to obfuscate program's strings"
icon        = "fa-regular fa-square-a-lock"
img_compare = true
+++

{{< hicon lvl=1 icon="fa-regular fa-square-a-lock" >}}Strings Encoding{{< /hicon >}}

{{< pass_purpose >}}
The purpose of the pass is to protect strings from a static analysis.
{{< /pass_purpose >}}

Strings, along with constants and symbols, are the kind of information that are quickly accessible
and very efficient in reverse engineering to guess or infer the purpose of a function.

In addition, some macros like `__FILE__` might also leak information about the original filename which
is also a valuable information.
If this macro is used in a header coming from a third-party SDK you might not be aware of this leak.

O-MVLL provides a modular configuration API to protect these information with different levels of protection.

## How to use it?

First, let's start with removing unwanted strings. If we consider the following function:

```cpp
#define LOG_ERROR(MSG) fprintf(stderr,"Error: %s (%s:%d)\n", MSG, __FILE__, __LINE__)

bool check_code(int code) {
  if (code != 47839) {
    LOG_ERROR("Wrong input");
    return false;
  }
  return true;
}
```

We can observe a leak of the original filename in the compiled binary:

```bash
$ strings ./strings.bin
...
libc.so
LIBC
libdl.so
libm.so
/home/romain/dev/o-mvll/tests/strings.cpp
...
```

To remove this unwanted string, we first need – as for the other obfuscation passes – to define the
associated function, `obfuscate_string`, in the configuration class:

```python
                           # LLVM module where the string is referenced
def obfuscate_string(self, mod: omvll.Module,
                           # Function that uses the string
                           func: omvll.Function,
                           # The string itself as a Python bytes object
                           string: bytes):
  pass
```

If the function `obfuscate_string` returns a string, then the original string
is replaced with the string returned. In our example, the original filename could be removed with this code:

```python
def obfuscate_string(self, _, __, string: bytes):
    if string.startswith(b"/home") and string.endswith(b".cpp"):
        return "REDACTED"
```

{{< alert type="danger" icon="fa-regular fa-bug" >}}
The input parameter string is a **bytes** object. Thus if we compare
with a Python **str** object, it will be always false (like: `string.endswith(".cpp")`)
{{</ alert >}}

The redacted string can be confirmed in the decompiled output:

{{< img-diff "img/redacted.webp" "img/leak.webp" "omvll">}}

Let's now consider the case where, instead of removing a string, we want to protect it:

```cpp {hl_lines="2-7"}
bool check_code(int code) {
  const char BANNER[] = R"delim(
  Hello gentle reverser,
  You are asked to enter the correct input that resolves this function.
  Thank you!
  )delim";
  printf("%s\n", BANNER);

  if (code != 47839) {
    LOG_ERROR("Wrong input");
    return false;
  }
  return true;
}
```

In this updated version of `check_code()`, the function prints a message that requires
to be protected. Since this string is **large** and **not really sensitive**,
it is recommended to protect this string with the O-MVLL option: `StringEncOptGlobal()`.

{{< alert type="info" icon="fa-light fa-list-tree" >}}
All the options accepted by this function are synthesized at the end of this section.
{{</ alert >}}

We can trigger this kind of protection as follows:

```python {hl_lines="5-6"}
def obfuscate_string(self, _, __, string: bytes):
    if string.startswith(b"/home") and string.endswith(b".cpp"):
        return "REDACTED"

    if b"Hello gentle reverse" in string:
        return omvll.StringEncOptGlobal()
```

With this option, the original string is encoded and stored in the `.data` section of the binary.
**As soon as** the binary is loaded, the string is decoded **in place** by a constructor function.

```cpp
const char BANNER[] = "\xD4\x24..."
__attribute__((constructor))
void decode() {
  // Decode the BANNER encoded buffer
}

bool check_code(int code) {
  ...
  printf("%s\n", BANNER);
  ...
}
```

{{< admonition color="info" title="Performances & Overhead" icon="fa-regular fa-circle-info">}}
`StringEncOptGlobal` is the option that produces the least overhead in terms of code size
and execution time.

On the other hand, the clear string is present in memory as soon as the binary is loaded
which makes it easily accessible through a memory dump. This limitation is discussed in the section
[Limitations](#limitations).

{{< /admonition >}}

Now let's evalutate the options that provide a better level of protection. The `.data` section
is easy to dump during the execution of the binary so it is not the best spot to decode a sensitive string.


*-> What about the stack? <i class="fa-solid fa-face-raised-eyebrow"> </i>*

The stack has interesting anti-dump properties for this operation:

1. The stack frame is local to a function (i.e not global as the `data` section)
2. The address where the string is decoded on the stack is not fixed at compile time
   (compare to the **relative** virtual address of the data section)

So the idea is to decode the string (from the `data` section) directly on the stack.

Let's consider this new version of the `check_code` function:

```cpp {hl_lines=[1, "10-11"]}
bool check_code(int code, const char* passwd) {
  const char BANNER[] = R"delim(
  Hello gentle reverser,
  You are asked to enter the correct input that resolves this function.
  Thank you!
  )delim";

  printf("%s\n", BANNER);

  const char PASS[] = "OMVLL";
  if (code != 47839 || strncmp(passwd, PASS, 6)) {
    LOG_ERROR("Wrong input");
    return false;
  }
  return true;
}
```

If we want to protect the `"OMVLL"` string through a stack decoding, we can return the
`StringEncOptStack`:

```python {hl_lines="8-9"}
def obfuscate_string(self, _, __, string: bytes):
    if string.startswith(b"/home") and string.endswith(b".cpp"):
        return "REDACTED"

    if b"Hello gentle reverse" in string:
        return omvll.StringEncOptGlobal()

    if string == b"OMVLL":
        return omvll.StringEncOptStack()
```

With such an option, `b"OMVLL"` will be decoded as follows:

```cpp {hl_lines="4-9"}
const char ENC_OMVLL = "\x1a\x9A\x21\x79\x37\x02";
bool check_code(int code) {
  char OMVLL_DECODED[6];
  OMVLL_DECODED[1] = ENC_OMVLL[1] ^ 0xd7;
  OMVLL_DECODED[5] = ENC_OMVLL[5] ^ 0x02;
  OMVLL_DECODED[2] = ENC_OMVLL[2] ^ 0x77;
  OMVLL_DECODED[0] = ENC_OMVLL[0] ^ 0x55;
  OMVLL_DECODED[4] = ENC_OMVLL[4] ^ 0x7b;
  OMVLL_DECODED[3] = ENC_OMVLL[3] ^ 0x35;

  if (code != 47839 || strncmp(passwd, OMVLL_DECODED, 6)) {
    ...
  }
}
```

As we can observe, a stack buffer with the same size as the original string is allocated on the stack.
It is also worth highlighting some aspects of this protection:

1. The indexes of the stack buffer where the `'char'` is decoded are shuffled.
2. The keystream used for decoding the string is unique.
3. The memory accesses of both, `OMVLL_DECODED` and `ENC_OMVLL` are protected with [Opaque Fields Access]({{< ref "/omvll/passes/opaque-fields-access" >}}).
4. The `xor` operation is protected with [Arithmetic Obfuscation]({{<ref "/omvll/passes/arithmetic" >}}).
5. Key's values are protected with [Opaque Constants]({{< ref "/omvll/passes/opaque-constants" >}}).

So in the end, the compiled and protected binary looks like this:

{{< img-diff "img/inline.webp" "img/clear.webp" "omvll">}}

As we can notice, this option **drastically** increases the code size for which
**the overhead is proportional** to the original length of the string.

{{< alert type="danger" icon="fa-regular fa-arrow-up-big-small" >}}
For these reasons and to avoid an important overhead, it is recommended to enable
this option on **small and very sensitive** strings.
{{</ alert >}}

Since this `StringEncOptStack` option can introduce **a non-negligible overhead** on large strings,
there is the possibility to tweak this protection by transforming the inlined decoding instructions into a loop:

```python {hl_lines="9"}
def obfuscate_string(self, _, __, string: bytes):
  if string.startswith(b"/home") and string.endswith(b".cpp"):
    return "REDACTED"

  if b"Hello gentle reverse" in string:
    return omvll.StringEncOptGlobal()

  if string == b"OMVLL":
    return omvll.StringEncOptStack(loopThreshold=0)
```

With this new `loopThreshold=0`, decoding of `b"OMVLL"` within `check_code` becomes:

```cpp {hl_lines="4-6"}
const char ENC_OMVLL = "\x1a\x9A\x21\x79\x37\x02";
bool check_code(int code) {
  char OMVLL_DECODED[6];
  for (size_t i = 0; i < 6; ++i) {
    OMVLL_DECODED[i] = ENC_OMVLL[i] ^ KEY[i];
  }

  if (code != 47839 || strncmp(passwd, OMVLL_DECODED, 6)) {
    ...
  }
}
```

In doing so, the function which uses the string does not pay the cost of the inlined instructions. In the
current design of the pass (which aims at being improved):

1. The key is a random `uint64_t` integer protected with [Opaque Constants]({{<ref "/omvll/passes/opaque-constants" >}}).
2. The `xor` operation is protected with MBA.
3. The previous operation changes pseudo-randomly.

In other words, it follows this layout:

```cpp
const char ENC_OMVLL = "\x1a\x9A\x21\x79\x37\x02";
bool check_code(int code) {
  char OMVLL_DECODED[6];
  uint64_t KEY = Random();
  for (size_t i = 0; i < 6; ++i) {
    OMVLL_DECODED[i] = Op(ENC_OMVLL[i], KEY, i);
  }

  if (code != 47839 || strncmp(passwd, OMVLL_DECODED, 6)) {
    ...
  }
}
```

On the final binary, it produces these changes:

{{< img-diff "img/loop.webp" "img/clear.webp" "omvll">}}

Compares to the inlined stack decoding routine, this loop avoids the linear relationship between
the string's length and the code generated for its protection. Thus, this option can be triggered when
the string to protect is medium-sized and sensitive.

From an implementation perspective, the loop is dynamically jitted **from C code** which is something
pretty new compared to the other LLVM-based obfuscator. Feel free to jump on [Implementation](#implementation)
for the details.

Here is the table that summarizes the different options:

| Value Returned                     | Protection | Overhead                                       |
|------------------------------------|------------|------------------------------------------------|
| `False, None`                      | None       | None                                           |
| `True`                             | Depends    | Depends                                        |
| `StringEncOptGlobal`               | Medium     | Low                                            |
| `StringEncOptStack(loopThreshold)` | Medium++   | Medium                                         |
| `StringEncOptStack()`              | High       | Medium for small string, High for long strings |


## When to use it?

This pass should always be enabled on your code, at least for checking and removing debug information or leaks
from macros.

For the other aspects of your code, you should consider enabling this protection for sensitive strings like
API Token (if any), log messages, secrets, etc.

Keep in mind that an insignificant string might be very significant for a reverse engineer even though it is not
directly related to a sensitive asset.

## Implementation

This pass works by iterating over all the instructions of a function and by filtering on those
that access a `llvm::GlobalVariable`.

If the `GlobalVariable` is associated with a C-String, the pass calls
the user's callback to determine which protection should be used. Depending on the value returned by
the user's callback, the pass performs one of the following operations:

### StringEncOptGlobal

With this option, the pass replaces the original clear string with its encoded version:

```cpp
std::vector<uint8_t> encoded(str.size());
...
Constant* StrEnc = ConstantDataArray::get(BB.getContext(), encoded);
G.setInitializer(StrEnc);
```

Then, it injects the decoding function as a constructor of the current `llvm::Module`:

```cpp
std::string Id = G.getGlobalIdentifier();
FunctionCallee FCallee = module->getOrInsertFunction(Id, FVoidTy);
auto* FCtor = cast<Function>(FCallee.getCallee());
FCtor->setLinkage(llvm::GlobalValue::PrivateLinkage);
...
appendToGlobalCtors(module, FCtor, 0);
```

This step is very similar to what we can observe in the O-LLVM's forks [^ollvm-github]. Nevertheless, there is
one difference that matters in terms of reverse engineering:

```cpp {hl_lines=2}
...
FCtor->setLinkage(llvm::GlobalValue::PrivateLinkage);
...
```

Actually, when using `getOrInsertFunction`, LLVM creates the function (if not already present) with a default
**EXTERNAL** visibility:

```cpp {hl_lines=6}
// In llvm/lib/IR/Module.cpp, as of LLVM 16
FunctionCallee Module::getOrInsertFunction(StringRef Name, FunctionType *Ty,
                                           AttributeList AttributeList) {
  if (!F) {
    // Nope, add it
    Function *New = Function::Create(Ty, GlobalVariable::ExternalLinkage,
                                     DL.getProgramAddressSpace(), Name);
  ...
}
```

This `ExternalLinkage` means that the constructor function will be considered as **exported** in
the final binary. Since the function is exported, its associated symbol **can't be stripped**.

In our implementation, the name of the constructor comes from `getGlobalIdentifier()` instead of `.datadiv_decode_...`:

{{< blockquote who="GlobalValue::getGlobalIdentifier()" where="llvm documentation" icon="fa-regular fa-file-circle-info">}}
Return the modified name for this global value suitable to be used as the key for a global lookup (e.g. profile or ThinLTO).
{{< / blockquote >}}

but in most of the O-LLVM's forks the name of the constructor is set as follows:

```cpp
uint64_t StringObfDecodeRandomName = cryptoutils->get_uint64_t();
...
std::string Id = ".datadiv_decode" + StringObfDecodeRandomName;
```

Since this name **can't** be stripped with an `ExternalLinkage`, the symbol is accessible from reverse engineers
who can immediately identify the purpose of the function. In addition, this symbol can be used as a marker to
fingerprint the obfuscator[^apkid]:

```js {hl_lines=13}
rule ollvm_v5_0_strenc : obfuscator
{
  meta:
    description = "Obfuscator-LLVM version 5.0 (string encryption)"
    url         = "https://github.com/obfuscator-llvm/obfuscator/wiki"
    sample      = "a794a080a92987ce5ed9cf5cd872ef87f9bfb9acd4c07653b615f4beaff3ace2"
    author      = "Eduardo Novella"

  strings:
    // "Obfuscator-LLVM clang version 5.0.2  (based on Obfuscator-LLVM 5.0.2)"
    $clang_version = "Obfuscator-LLVM clang version 5.0."
    $based_on      = "(based on Obfuscator-LLVM 5.0."
    $strenc        = /\.datadiv_decode[\d]{18,20}/  // Enumerating elf.symtab_entries fails!

  condition:
    is_elf and
    all of them
}
```

Once, we added the constructor with a proper visibility, the pending question is:

*How to fill the constructor with instructions?*

Basically, the constructor must contain the instructions that decode the encoded string. Thanks to the IR LLVM
API, we can manually create a loop, add the decoding operations, etc. This approach works and is efficient but
there are a few drawbacks:

1. The decoding logic is not really modular: we have to manually write the routine with the `llvm::IRBuilder`.
2. It is error prone if the decoding logic is complex.

On the other hand, LLVM also contains a JIT engine and a C/C++ frontend -- aka clang -- we could use
to dynamically JIT C/C++ source code:

```cpp
llvm::Module* MJIT = TargetJIT->generate(R"delim(
  void decode(char* out, char* in, unsigned long long key, int size) {
    unsigned char* raw_key = (unsigned char*)(&key);
    for (int i = 0; i < size; ++i) {
      out[i] = in[i] ^ raw_key[i % sizeof(key)] ^ i;
    }
  }
)delim");

Function* FDecode = MJIT->getFunction("decode");
CloneFunctionInto(FCtor, FDecode, ...);
```

Since a decoding routine is paired with an encoding routine, we can also JIT the encoding routine
(for the architecture on which O-MVLL is running),
to *"blindly"* encode the string:

```cpp
auto JIT = HostJIT->compile(
R"delim(
 void encode(char* out, char* in, unsigned long long key, int size) {
   unsigned char* raw_key = (unsigned char*)(&key);
   for (int i = 0; i < size; ++i) {
     out[i] = in[i] ^ raw_key[i % sizeof(key)] ^ i;
   }
   return;
 }
)delim");

if (auto E = HostJit->lookup("encode")) {
  auto enc = reinterpret_cast<enc_routine_t>(E->getAddress());
  enc(encoded.data(), str.data(), key, str.size());
}
...
Constant* StrEnc = ConstantDataArray::get(BB.getContext(), encoded);
G.setInitializer(StrEnc);
```

In its current implementation, the `encode/decode` functions are statically written in the code of the pass,
but we could also imagine supporting routines provided by the user through Python APIs:

```python
def obfuscate_string(self, _, __, string: bytes):
  return StringEncOpt("""
    void encode(...) { /* My secret implementation */ }
    void decode(...) { /* My secret implementation */ }
  """)
```

You can find more details about the JIT engine used in O-MVLL in the section [LLVM JIT]({{< ref "/omvll/other-topics/jit" >}}).

### StringEncOptStack Looped

If the option `StringEncOptStack` is provided, for which the string is eligible to a loop, the pass
starts by allocating a buffer:

```cpp
AllocaInst* clearBuffer = IRB.CreateAlloca(IRB.getInt8Ty(),
                                           IRB.getInt32(str.size()));

```

Then it injects the decoding routine using the same JIT-technique as [StringEncOptGlobal](#StringEncOptGlobal).

Finally, it replaces the original instruction's operand -- which referenced the clear string -- with the new stack buffer:

```cpp
I.setOperand(Op.getOperandNo(), clearBuffer);
```

### StringEncOptStack Inline

If the string must be inline-decoded on stack, the pass starts by allocating a buffer:

```cpp
AllocaInst* clearBuffer = IRB.CreateAlloca(IRB.getInt8Ty(),
                                           IRB.getInt32(str.size()));
```

Then, the pass loops over the (shuffled) indexes of the string to individually create IR instructions that
decode the characters:

```cpp
for (size_t i = 0; i < str.size(); ++i) {
  Value *EncGEP = IRB.CreateGEP(..., encBuffer  , ...);
  Value* DecGEP = IRB.CreateGEP(..., clearBuffer, ...);

  // Load the encoded character and its key
  LoadInst* EncVal = IRB.CreateLoad(IRB.getInt8Ty(), EncGEP);
  LoadInst* KeyVal = IRB.CreateLoad(...);

  // Create the decode operation
  Value* DecVal = IRB.CreateXor(EncVal, KeyVal);

  // Store the decoded character
  StoreInst* StoreClear = IRB.CreateStore(DecVal, DecGEP);
}
```

Without any additional protections, these IR-created instructions would be very easy to reverse. That's why
the pass also adds custom annotations (c.f. [Obfuscation Annotations]({{< ref "/omvll/other-topics/annotations" >}}))
to trigger other O-MVLL obfuscations:

```cpp {hl_lines=[7, 10, 14, 18]}
for (size_t i = 0; i < str.size(); ++i) {
  Value *EncGEP = IRB.CreateGEP(..., encBuffer  , ...);
  Value* DecGEP = IRB.CreateGEP(..., clearBuffer, ...);

  // Load the encoded character and its key
  LoadInst* EncVal = IRB.CreateLoad(IRB.getInt8Ty(), EncGEP);
  addMetadata(*EncVal, MetaObf(PROTECT_FIELD_ACCESS));

  LoadInst* KeyVal = IRB.CreateLoad(...);
  addMetadata(*KeyVal, MetaObf(PROTECT_FIELD_ACCESS));

  // Create the decode operation
  Value* DecVal = IRB.CreateXor(EncVal, KeyVal);
  addMetadata(*DecVal, MetaObf(OPAQUE_OP, 2llu));

  // Store the decoded character
  StoreInst* StoreClear = IRB.CreateStore(DecVal, DecGEP);
  addMetadata(*StoreClear, MetaObf(PROTECT_FIELD_ACCESS));
}
```

## Limitations

As already mentioned at the beginning, a string protected with the option `StringEncOptGlobal` can be
easily recovered by dumping the `data` section once the binary is loaded. On the other hand, strings
protected with the `StringEncOptStack` option are not subject to the dump attack but they could be recovered
with a memory trace generated by a DBI (c.f. [Android Native Library Analysis with QBDI: Encoding Routine](https://blog.quarkslab.com/android-native-library-analysis-with-qbdi.html#encoding-routine)).

Attackers could also use code lifting or emulation to automatically decode the strings. The scalability and
the feasibility of the code lifting and the emulation highly depend on the design of the function.

{{< alert type="warning" icon="fa-brands fa-apple">}}
This pass does not currently support Objective-C strings.
{{< /alert >}}

## References

{{< include-references "references.yml" >}}

[^ollvm-github]: See for instance: [kk-laoguo/ollvm-13](https://github.com/kk-laoguo/ollvm-13/blob/e4fdfebfc7da3e89469d9e6095c3486029cea106/llvm-project-13/llvm/lib/Transforms/Obfuscation/StringObfuscation.cpp#L121-L139)
[^apkid]: [apkid/rules/elf/obfuscators.yara](https://github.com/rednaga/APKiD/blob/a50ee3b4a42a3e1a284af9eafa79e41ee80bc59f/apkid/rules/elf/obfuscators.yara#L100-L117)
