+++
title       = "Function Outline"
description = "This pass outlines basic blocks into standalone routines"
icon        = "fa-regular fa-crop"
img_compare = true
+++

{{< hicon lvl=1 icon="fa-regular fa-crop" >}}Function Outline{{< /hicon >}}

{{< pass_purpose >}}
This pass aims at fragmenting the program's functions by outlining selected basic
blocks into new dedicated functions. The outlined region is replaced with a call-site
to the newly-created function.
{{< /pass_purpose >}}

{{< compare "svg/function-outline-1.svg" "svg/function-outline-2.svg" "omvll">}}

Static analysis tools rely on examining the control-flow graph of a function to
understand its logic and reason about its behavior. This pass attempts to disrupt this
premise by randomly breaking up function bodies, lifting basic blocks into dedicated
functions.

## When to use it?

As for the other passes, it is recommended to employ FunctionOutline on functions
calling security-sensitive routines. To limit code-size growth and extra calls
overhead, it is also recommended to enable the pass probabilistically. Furthermore,
it may be recommended to schedule the pass either after Inliner has executed, or
marking the outlined function as `noinline`. For increased security, it is suggested
to enable the pass in conjunction with other passes.

## How to use it?

In the Python configuration callback, enable the pass by returning **`True`** to
apply everywhere, or enable it probabilistically (at the granularity of basic blocks),
as shown below:

```python
def function_outline(self, mod: omvll.Module, func: omvll.Function):
  # Select basic blocks with a 30% probability.
  return omvll.FunctionOutlineWithProbability(20)
```

## Implementation

The pass visits each function and samples randomly outline candidates based on a
user-provided probability. For each collected basic block, some checks filters are
performed (on top of `CodeExtractor::isEligible` ones), such as excluding blocks
with stack manipulation intrinsics or those performing exception handling. LLVM
CodeExtractor utility is then used on the single-block region to create a new
function and replace the original block with a call-site to it. Any values defined
or used across the boundary may become parameters or return values.

For example, the following basic block:

```llvm
entry:
  ; ...
  br label %block

block:
  %add = add i32 %x, %y
  ret i32 %add
```

May be rewritten as follows (modulo some optimizations):

```llvm
entry:
  %val = call i32 @outlined.func(i32 %x, i32 %y)
  ret i32 %val
```

Where `outlined.func` is the outlined function:

```llvm
define i32 @outlined.func(i32 %x, i32 %y) {
entry:
  %add = add i32 %x, %y
  ret i32 %add
}
```

## Limitations

- One may incur moderate performance penalty due to the overhead coming from increased
  code size as well as extra bookkeeping (prologues/epilogues, pushing return address,
  etc.) for the new outlined functions.
