+++
title       = "Indirect Branch"
description = "This pass can be used to conceal jump target addresses"
icon        = "fa-regular fa-shuffle"
img_compare = true
+++

{{< hicon lvl=1 icon="fa-regular fa-shuffle" >}}Indirect Branch{{< /hicon >}}

{{< pass_purpose >}}
This pass aims at concealing the program control-flow graph by converting direct branches
into indirect ones, making jump targets statically unknown. Jump destination are fetched
from a shuffled, read-only jump table.
{{< /pass_purpose >}}

{{< alert type="danger" icon="fa-brands fa-apple">}}
There are known limitations on **<u>iOS</u>** for applications built in Release mode.
{{< /alert >}}

Static analysis tools rely on explicit branch targets when attempting to reconstruct the
boundaries of a function and its control-flow, as accurately as possible. `IndirectBranch`
pass aims at severing the control-flow edges: each jump successor is added to a table,
which is later indexed in order to compute the jump target at runtime.

## When to use it?

As for the other passes, it is recommended to employ IndirectBranch on sensible functions.
The pass comes with a high runtime performance overhead and extra code size, hence, it is
advisable to enable it with a low probability, or on a handful of selected routines.
For increased security, it is suggested to enable the pass in conjunction with other passes.

## How to use it?

In the Python configuration callback, the pass is suggested to be enabled for selective
usage by leveraging the `default_config` method as follows:

```python
def indirect_branch(self, mod: omvll.Module, func: omvll.Function):
  # Skip obfuscating third-party modules and apply the pass with a 5% likelihood.
  return omvll.ObfuscationConfig.default_config(self, mod, fun, ["third-party/"], [], [], 5)
```

## Implementation

First off, branch and switch instructions terminators are collected. These are those which
delimits a basic block. Likewise, all the basic block successors are gathered, and a
per-function global array is created with all the basic block addresses (a LLVM BlockAddress),
sparsed randomly.

Next, each previously gathered branch is visited and is replaced into an indirect branch by
locating and loading the actual successor target from the jump table. More specifically,
the following `br` IR instruction performing a conditional branch depending on whether the
integer `%value` is zero or not:

```llvm
  %cmp = icmp eq i32 %value, 0
  br i1 %cmp, label %true, label %false
```

Is rewritten as follows:

```llvm
  %idx.bb.true  = getelementptr inbounds ([8 x i64], ptr @.indbr.block_addresses, i64 0, i64 %idx)
  %idx.bb.false = getelementptr inbounds ([8 x i64], ptr @.indbr.block_addresses, i64 0, i64 %idx2)
  %bb.true_or_bb.false = select i1 %cmp, ptr %idx.bb.true, ptr %idx.bb.false
  %bb.address = load ptr, ptr %bb.true_or_bb.false
  indirectbr ptr %bb.address, [label %true, label %false]
```

As it can be seen, the direct jump has been translated via a `indirectbr`, whose target address
derives from a blockaddress stored in the `@.indbr.block_addresses` global array. Depending on
condition `%cmp`, the basic block address corresponding to the true label or the false one is
loaded and passed as operand to the `indirectbr`.

As such, the jump address label is reconstructed and computed at runtime.

## Limitations

- **The pass currently has known limitations on iOS applications built in *Release* mode.**

- Functions annotated with `alwaysinline` are skipped as `indirectbr` instructions may prevent
  inlining from occurring.

- The pass currently attempts to translate LLVM critical edges too, although this may break
  invariants that later code-motion optimizations expect.

- One may incur high performance penalties due to the overhead coming from the further layer of
  indirection.
