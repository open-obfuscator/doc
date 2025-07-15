+++
title       = "Indirect Call"
description = "This pass can be used to conceal function call addresses"
icon        = "fa-regular fa-code-branch"
img_compare = true
math        = true
+++

{{< hicon lvl=1 icon="fa-regular fa-code-branch" >}}Indirect Call{{< /hicon >}}

{{< pass_purpose >}}
This pass aims at concealing the program's call graph by converting direct function
calls into indirect calls, whose target address is reconstructed on the fly from two
random, statically stored shares.
{{< /pass_purpose >}}

Static analysis tools lean heavily on the call graph for interprocedural analyses, as
it allows them to follow control-flow across different functions, propagate data-flow
facts, as well as figure out how these calls affect the state of the program.
`IndirectCall` pass attempts to break these premises, by hiding function call edges
via an extra layer of indirection, whilst preserving the original execution semantics.

## When to use it?

As for the other passes, it is recommended to employ IndirectCall on functions calling
security-sensitive routines, where these latter are possibly referenced only a handful
of times. In order to incur low runtime overhead and keep the code size moderate, it is
also recommended to enable the pass probabilistically. For increased security, it is
suggested to enable the pass in conjunction with other passes.

## How to use it?

In the Python configuration callback, enable the pass by returning **`True`** to apply
everywhere, or, e.g., the following for selective usage:

```python
def indirect_call(self, mod: omvll.Module, func: omvll.Function):
  # Skip obfuscating third-party modules and apply the pass with a 20% likelihood.
  return omvll.ObfuscationConfig.default_config(self, mod, fun, ["third-party/"], [], [], 20)
```

## Implementation

At each eligible call-site, the pass picks an aligned random value $S_1$ and computes:

$$S_2 = S_1 + CalleeAddress$$

as a LLVM constant expression. Such direct calls are collected, and so is being done
for the shares, which are grouped into two separate internal read-only global arrays.

Next, each previously gathered call-site is visited, and the called function operand is
replaced with the difference of the two shares, both indexed from the two arrays for this
call-site. More specifically, the following IR instruction performing a call to function
`callee`:

```llvm
  call void @callee()
```

Is rewritten as follows:

```llvm
  %idx.share1 = getelementptr inbounds ([8 x i64], ptr @.icall.shares1, i64 0, i64 %idx)
  %idx.share2 = getelementptr inbounds ([8 x i64], ptr @.icall.shares2, i64 0, i64 %idx)
  %share1 = load i64, ptr %idx.share1
  %share2 = load i64, ptr %idx.share2
  %callee_address = sub i64 %share2, %share1
  %fn_ptr = inttoptr i64 %callee_address to ptr
  call void %fn_ptr()
```

As it can be seen, the two shares are loaded from the two global arrays `@.icall.shares1` and
`@.icall.shares2`, and the difference between the two is carried out. The result is cast
to a pointer, which is now used as operand of the call-site, leading to a call to a pointer
to the original function. 

As such, the target address is reconstructed and computed at runtime.

## Limitations

- Functions marked as `alwaysinline` are skipped to let the call-site be inlineable.

- One may incur performance penalties due to the overhead coming from the further layer of indirection.
