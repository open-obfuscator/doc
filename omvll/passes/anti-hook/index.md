+++
title       = "Anti-Hooking"
description = "This pass can be used to prevent Frida hooking"
icon        = "fa-regular fa-tachograph-digital"
img_compare = true
+++

{{< hicon lvl=1 icon="fa-regular fa-tachograph-digital" >}}Anti-Hooking{{< /hicon >}}

{{< pass_purpose >}}
The purpose of this pass is to protect functions against hooking frameworks like Frida.
{{< /pass_purpose >}}

{{< alert type="danger" icon="fa-brands fa-apple">}}
This pass does work well for **<u>iOS</u>** because of an internal issue in the setup of the JIT Engine.
{{< /alert >}}

{{< compare "svg/anti-hook-1.svg" "svg/anti-hook-2.svg" "omvll">}}

Hooking is used for *hijacking* a function call to observe or change the parameters and the return value of the
hijacked function. You should protect a function against hooking if the parameters of the function are sensitive.

For instance, let's consider the following snippet:

```cpp
void encrypt(char key[16]) {
  ...
}
```

The function `encrypt()` should be protected against hooking otherwise an attacker could easily observe the
effective value of the `key` parameter when the function is called.

Similarly, if the value returned by the function is sensitive then, you should also protect your function.

```cpp
bool has_secure_enclave() {
...
}
```

## When to use it?

You should enable this protecting for all your sensitive functions. This pass introduces a very low overhead
while still being efficient against Frida.

## How to use it?

In the O-MVLL configuration file, this protection can be enabled by defining the following method:

```python
def anti_hooking(self, mod: omvll.Module, func: omvll.Function) -> omvll.AntiHookOpt:
    if func.name in ["encrypt", "has_secure_enclave"]:
        return True
    return False
```

## Implementation

Usually, hooking frameworks need a scratch register to relocate or access metadata associated with the
function currently hooked.
In the case of Frida, the *relocator* needs one of the `x16`, `x17` registers as we can see in
[gumarm64relocator.c](https://github.com/frida/frida-gum/blob/5fdc2952d753895ca9acd327e47e6aa1a395a332/gum/arch-arm64/gumarm64relocator.c#L521-L553)

```c
if (available_scratch_reg != NULL)
{
  gboolean x16_used, x17_used;
  guint insn_index;

  x16_used = FALSE;
  x17_used = FALSE;
  ...
  if (!x16_used)
     *available_scratch_reg = ARM64_REG_X16;
   else if (!x17_used)
     *available_scratch_reg = ARM64_REG_X17;
   else
     *available_scratch_reg = ARM64_REG_INVALID;
}
```

If the prologue of the function starts with instructions that used these two registers, Frida fails
to hook the function. Let's consider the following Frida script:

```js
console.log("Hello!")
Interceptor.attach(Module.getExportByName('omvll_test.bin', 'hook_me'), {
  onEnter(args) {
    console.log("Yes I hooked you!")
  },
  onLeave(retval) {
    console.log("Frida exit from hook_me()")
  }
});
```

If the prologue of `hook_me()` starts by using `x16` and `x17`, Frida raises the following error:

```bash
$ frida  --file=/data/local/tmp/omvll_test.bin --load=./test.js --stdio=pipe --no-pause
     ____
    / _  |   Frida 15.1.17 - A world-class dynamic instrumentation toolkit
   | (_| |
    > _  |   Commands:
   /_/ |_|       help      -> Displays the help system
   . . . .       object?   -> Display information about 'object'
   . . . .       exit/quit -> Exit
   . . . .
   . . . .   More info at https://frida.re/docs/home/
Spawning `/data/local/tmp/omvll_test.bin`...
Hello!
Spawned `/data/local/tmp/omvll_test.bin`. Resuming main thread!
Error: unable to intercept function at 0x623d443158; please file a bug
    at value (frida/runtime/core.js:316)
    at <eval> (/test.js:19)
```

On the O-MVLL implementation hand side, it works by setting a custom prologue to the `llvm::Function` that must
be protected:

```cpp
bool AntiHook::runOnFunction(llvm::Function &F) {
  std::unique_ptr<MemoryBuffer> Buffer = ...;
  auto* Int8Ty = Type::getInt8Ty(F.getContext());
  auto* Prologue = ConstantDataVector::getRaw(
                    Buffer->getBuffer(), Buffer->getBufferSize(), Int8Ty);

  F.setPrologueData(Prologue);
  return true;
}
```

The prologue injected by the pass is located in a *`MemoryBuffer`* that is generated thanks to the O-MVLL's JIT engine
(based on [LLVM ORCv2](https://llvm.org/docs/ORCv2.html)). With this Jitter, it generates the raw stub as follows:

```cpp
std::unique_ptr<MemoryBuffer> Buffer = jitter->jitAsm(
  R"delim(
    mov x17, x17;
    mov x16, x16;
  )delim"
);
```

This API is modular enough to **dynamically** JIT **different** stubs.

## Limitations

The current implementation does not use a *strong binding* between the custom anti-hooking prologue and
the original function.
It means that an attacker could patch the prologue of the function to remove the instructions that trigger the
Frida error.

In its current form, the stub injected in the prologue of the functions only prevents Frida from hooking a
user-controlled function.
In particular, this pass **is not able** to protect against hooking on **imported functions** (like `fopen`, `read` etc)
and does not prevent other hooking frameworks like [Dobby](https://github.com/jmpews/Dobby) from
working correctly.

If hooking really matters, we strongly recommend adding another detection layer to perform enhanced checks
based -- for instance -- on the artifacts left by the different hooking frameworks.

## Origin of this pass

I actually experienced this limitation of Frida while reverse-engineering [SafetyNet/DroidGuard](https://www.romainthomas.fr/publication/22-sstic-blackhat-droidguard-safetynet/).

The bytecode of the VM performs -- at some point -- an integrity check of the code using SHA-1 from OpenSSL.
The implementation of this hash algorithm in OpenSSL is partially based on a raw assembly stub,
in which the function `sha1_block_data_order()` begins as follows in [crypto/sha/asm/sha1-armv8.pl](https://github.com/openssl/openssl/blob/6e6aad333f26694ff39aba1e59b358e3f25a9a1d/crypto/sha/asm/sha1-armv8.pl#L183-L193):

```armasm
sha1_block_data_order:
  ldr  x16,  .LOPENSSL_armcap_P
  adr  x17,  .LOPENSSL_armcap_P
  add  x16,  x16, x17
  ldr  w16,  [x16]
  tst  w16,  #ARMV8_SHA1
  b.ne .Lv8_entry
  ...
```



