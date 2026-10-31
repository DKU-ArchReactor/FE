	.file	"source.c"
	.option nopic
	.attribute arch, "rv32i2p1_m2p0"
	.attribute unaligned_access, 0
	.attribute stack_align, 16
	.text
.Ltext0:
	.cfi_sections	.debug_frame
	.file 0 "/app" "/tmp/tmpkl0xk4iy/source.c"
	.align	2
	.globl	sum_array
	.type	sum_array, @function
sum_array:
.LFB0:
	.file 1 "/tmp/tmpkl0xk4iy/source.c"
	.loc 1 17 1
	.cfi_startproc
	addi	sp,sp,-48
	.cfi_def_cfa_offset 48
	sw	ra,44(sp)
	sw	s0,40(sp)
	.cfi_offset 1, -4
	.cfi_offset 8, -8
	addi	s0,sp,48
	.cfi_def_cfa 8, 0
	sw	a0,-36(s0)
	sw	a1,-40(s0)
	.loc 1 18 9
	sw	zero,-20(s0)
.LBB2:
	.loc 1 19 14
	sw	zero,-24(s0)
	.loc 1 19 5
	j	.L2
.L3:
	.loc 1 20 22
	lw	a5,-24(s0)
	slli	a5,a5,2
	lw	a4,-36(s0)
	add	a5,a4,a5
	lw	a5,0(a5)
	.loc 1 20 13
	lw	a4,-20(s0)
	add	a5,a4,a5
	sw	a5,-20(s0)
	.loc 1 19 33 discriminator 3
	lw	a5,-24(s0)
	addi	a5,a5,1
	sw	a5,-24(s0)
.L2:
	.loc 1 19 23 discriminator 1
	lw	a4,-24(s0)
	lw	a5,-40(s0)
	blt	a4,a5,.L3
.LBE2:
	.loc 1 22 12
	lw	a5,-20(s0)
	.loc 1 23 1
	mv	a0,a5
	lw	ra,44(sp)
	.cfi_restore 1
	lw	s0,40(sp)
	.cfi_restore 8
	.cfi_def_cfa 2, 48
	addi	sp,sp,48
	.cfi_def_cfa_offset 0
	jr	ra
	.cfi_endproc
.LFE0:
	.size	sum_array, .-sum_array
	.align	2
	.globl	sum_list
	.type	sum_list, @function
sum_list:
.LFB1:
	.loc 1 26 1
	.cfi_startproc
	addi	sp,sp,-48
	.cfi_def_cfa_offset 48
	sw	ra,44(sp)
	sw	s0,40(sp)
	.cfi_offset 1, -4
	.cfi_offset 8, -8
	addi	s0,sp,48
	.cfi_def_cfa 8, 0
	sw	a0,-36(s0)
	.loc 1 27 9
	sw	zero,-20(s0)
	.loc 1 28 11
	j	.L6
.L7:
	.loc 1 29 20
	lw	a5,-36(s0)
	lw	a5,0(a5)
	.loc 1 29 13
	lw	a4,-20(s0)
	add	a5,a4,a5
	sw	a5,-20(s0)
	.loc 1 30 14
	lw	a5,-36(s0)
	lw	a5,4(a5)
	sw	a5,-36(s0)
.L6:
	.loc 1 28 17
	lw	a5,-36(s0)
	bne	a5,zero,.L7
	.loc 1 32 12
	lw	a5,-20(s0)
	.loc 1 33 1
	mv	a0,a5
	lw	ra,44(sp)
	.cfi_restore 1
	lw	s0,40(sp)
	.cfi_restore 8
	.cfi_def_cfa 2, 48
	addi	sp,sp,48
	.cfi_def_cfa_offset 0
	jr	ra
	.cfi_endproc
.LFE1:
	.size	sum_list, .-sum_list
	.align	2
	.globl	tree_find
	.type	tree_find, @function
tree_find:
.LFB2:
	.loc 1 36 1
	.cfi_startproc
	addi	sp,sp,-32
	.cfi_def_cfa_offset 32
	sw	ra,28(sp)
	sw	s0,24(sp)
	.cfi_offset 1, -4
	.cfi_offset 8, -8
	addi	s0,sp,32
	.cfi_def_cfa 8, 0
	sw	a0,-20(s0)
	sw	a1,-24(s0)
	.loc 1 37 11
	j	.L10
.L14:
	.loc 1 38 24
	lw	a5,-20(s0)
	lw	a5,0(a5)
	.loc 1 38 12
	lw	a4,-24(s0)
	bne	a4,a5,.L11
	.loc 1 39 24
	lw	a5,-20(s0)
	lw	a5,0(a5)
	j	.L12
.L11:
	.loc 1 41 23
	lw	a5,-20(s0)
	lw	a5,0(a5)
	.loc 1 41 12
	lw	a4,-24(s0)
	bge	a4,a5,.L13
	.loc 1 42 18
	lw	a5,-20(s0)
	lw	a5,4(a5)
	sw	a5,-20(s0)
	j	.L10
.L13:
	.loc 1 44 18
	lw	a5,-20(s0)
	lw	a5,8(a5)
	sw	a5,-20(s0)
.L10:
	.loc 1 37 17
	lw	a5,-20(s0)
	bne	a5,zero,.L14
	.loc 1 47 12
	li	a5,-1
.L12:
	.loc 1 48 1
	mv	a0,a5
	lw	ra,28(sp)
	.cfi_restore 1
	lw	s0,24(sp)
	.cfi_restore 8
	.cfi_def_cfa 2, 32
	addi	sp,sp,32
	.cfi_def_cfa_offset 0
	jr	ra
	.cfi_endproc
.LFE2:
	.size	tree_find, .-tree_find
	.align	2
	.globl	maximum
	.type	maximum, @function
maximum:
.LFB3:
	.loc 1 54 1
	.cfi_startproc
	addi	sp,sp,-48
	.cfi_def_cfa_offset 48
	sw	ra,44(sp)
	sw	s0,40(sp)
	.cfi_offset 1, -4
	.cfi_offset 8, -8
	addi	s0,sp,48
	.cfi_def_cfa 8, 0
	sw	a0,-36(s0)
	sw	a1,-40(s0)
	.loc 1 55 8
	lw	a5,-40(s0)
	bgt	a5,zero,.L16
	.loc 1 56 16
	li	a5,0
	j	.L17
.L16:
	.loc 1 58 9
	lw	a5,-36(s0)
	lw	a5,0(a5)
	sw	a5,-20(s0)
.LBB3:
	.loc 1 59 14
	li	a5,1
	sw	a5,-24(s0)
	.loc 1 59 5
	j	.L18
.L20:
	.loc 1 60 19
	lw	a5,-24(s0)
	slli	a5,a5,2
	lw	a4,-36(s0)
	add	a5,a4,a5
	lw	a5,0(a5)
	.loc 1 60 12
	lw	a4,-20(s0)
	bge	a4,a5,.L19
	.loc 1 61 29
	lw	a5,-24(s0)
	slli	a5,a5,2
	lw	a4,-36(s0)
	add	a5,a4,a5
	.loc 1 61 21
	lw	a5,0(a5)
	sw	a5,-20(s0)
.L19:
	.loc 1 59 33 discriminator 2
	lw	a5,-24(s0)
	addi	a5,a5,1
	sw	a5,-24(s0)
.L18:
	.loc 1 59 23 discriminator 1
	lw	a4,-24(s0)
	lw	a5,-40(s0)
	blt	a4,a5,.L20
.LBE3:
	.loc 1 64 12
	lw	a5,-20(s0)
.L17:
	.loc 1 65 1
	mv	a0,a5
	lw	ra,44(sp)
	.cfi_restore 1
	lw	s0,40(sp)
	.cfi_restore 8
	.cfi_def_cfa 2, 48
	addi	sp,sp,48
	.cfi_def_cfa_offset 0
	jr	ra
	.cfi_endproc
.LFE3:
	.size	maximum, .-maximum
	.align	2
	.globl	reverse
	.type	reverse, @function
reverse:
.LFB4:
	.loc 1 68 1
	.cfi_startproc
	addi	sp,sp,-48
	.cfi_def_cfa_offset 48
	sw	ra,44(sp)
	sw	s0,40(sp)
	.cfi_offset 1, -4
	.cfi_offset 8, -8
	addi	s0,sp,48
	.cfi_def_cfa 8, 0
	sw	a0,-36(s0)
	sw	a1,-40(s0)
	.loc 1 69 9
	sw	zero,-20(s0)
	.loc 1 70 9
	lw	a5,-40(s0)
	addi	a5,a5,-1
	sw	a5,-24(s0)
	.loc 1 71 11
	j	.L22
.L23:
.LBB4:
	.loc 1 72 27
	lw	a5,-20(s0)
	slli	a5,a5,2
	lw	a4,-36(s0)
	add	a5,a4,a5
	.loc 1 72 13
	lw	a5,0(a5)
	sw	a5,-28(s0)
	.loc 1 73 30
	lw	a5,-24(s0)
	slli	a5,a5,2
	lw	a4,-36(s0)
	add	a4,a4,a5
	.loc 1 73 15
	lw	a5,-20(s0)
	slli	a5,a5,2
	lw	a3,-36(s0)
	add	a5,a3,a5
	.loc 1 73 30
	lw	a4,0(a4)
	.loc 1 73 22
	sw	a4,0(a5)
	.loc 1 74 15
	lw	a5,-24(s0)
	slli	a5,a5,2
	lw	a4,-36(s0)
	add	a5,a4,a5
	.loc 1 74 23
	lw	a4,-28(s0)
	sw	a4,0(a5)
	.loc 1 75 13
	lw	a5,-20(s0)
	addi	a5,a5,1
	sw	a5,-20(s0)
	.loc 1 76 14
	lw	a5,-24(s0)
	addi	a5,a5,-1
	sw	a5,-24(s0)
.L22:
.LBE4:
	.loc 1 71 17
	lw	a4,-20(s0)
	lw	a5,-24(s0)
	blt	a4,a5,.L23
	.loc 1 78 1
	nop
	nop
	lw	ra,44(sp)
	.cfi_restore 1
	lw	s0,40(sp)
	.cfi_restore 8
	.cfi_def_cfa 2, 48
	addi	sp,sp,48
	.cfi_def_cfa_offset 0
	jr	ra
	.cfi_endproc
.LFE4:
	.size	reverse, .-reverse
	.align	2
	.globl	insertion_sort
	.type	insertion_sort, @function
insertion_sort:
.LFB5:
	.loc 1 81 1
	.cfi_startproc
	addi	sp,sp,-48
	.cfi_def_cfa_offset 48
	sw	ra,44(sp)
	sw	s0,40(sp)
	.cfi_offset 1, -4
	.cfi_offset 8, -8
	addi	s0,sp,48
	.cfi_def_cfa 8, 0
	sw	a0,-36(s0)
	sw	a1,-40(s0)
.LBB5:
	.loc 1 82 14
	li	a5,1
	sw	a5,-20(s0)
	.loc 1 82 5
	j	.L25
.L29:
.LBB6:
	.loc 1 83 25
	lw	a5,-20(s0)
	slli	a5,a5,2
	lw	a4,-36(s0)
	add	a5,a4,a5
	.loc 1 83 13
	lw	a5,0(a5)
	sw	a5,-28(s0)
	.loc 1 84 13
	lw	a5,-20(s0)
	addi	a5,a5,-1
	sw	a5,-24(s0)
	.loc 1 85 15
	j	.L26
.L28:
	.loc 1 86 35
	lw	a5,-24(s0)
	slli	a5,a5,2
	lw	a4,-36(s0)
	add	a4,a4,a5
	.loc 1 86 19
	lw	a5,-24(s0)
	addi	a5,a5,1
	slli	a5,a5,2
	lw	a3,-36(s0)
	add	a5,a3,a5
	.loc 1 86 35
	lw	a4,0(a4)
	.loc 1 86 27
	sw	a4,0(a5)
	.loc 1 87 14
	lw	a5,-24(s0)
	addi	a5,a5,-1
	sw	a5,-24(s0)
.L26:
	.loc 1 85 23
	lw	a5,-24(s0)
	blt	a5,zero,.L27
	.loc 1 85 32 discriminator 1
	lw	a5,-24(s0)
	slli	a5,a5,2
	lw	a4,-36(s0)
	add	a5,a4,a5
	lw	a5,0(a5)
	.loc 1 85 23 discriminator 1
	lw	a4,-28(s0)
	blt	a4,a5,.L28
.L27:
	.loc 1 89 15
	lw	a5,-24(s0)
	addi	a5,a5,1
	slli	a5,a5,2
	lw	a4,-36(s0)
	add	a5,a4,a5
	.loc 1 89 23
	lw	a4,-28(s0)
	sw	a4,0(a5)
.LBE6:
	.loc 1 82 33 discriminator 2
	lw	a5,-20(s0)
	addi	a5,a5,1
	sw	a5,-20(s0)
.L25:
	.loc 1 82 23 discriminator 1
	lw	a4,-20(s0)
	lw	a5,-40(s0)
	blt	a4,a5,.L29
.LBE5:
	.loc 1 91 1
	nop
	nop
	lw	ra,44(sp)
	.cfi_restore 1
	lw	s0,40(sp)
	.cfi_restore 8
	.cfi_def_cfa 2, 48
	addi	sp,sp,48
	.cfi_def_cfa_offset 0
	jr	ra
	.cfi_endproc
.LFE5:
	.size	insertion_sort, .-insertion_sort
	.align	2
	.globl	binary_search
	.type	binary_search, @function
binary_search:
.LFB6:
	.loc 1 94 1
	.cfi_startproc
	addi	sp,sp,-48
	.cfi_def_cfa_offset 48
	sw	ra,44(sp)
	sw	s0,40(sp)
	.cfi_offset 1, -4
	.cfi_offset 8, -8
	addi	s0,sp,48
	.cfi_def_cfa 8, 0
	sw	a0,-36(s0)
	sw	a1,-40(s0)
	sw	a2,-44(s0)
	.loc 1 95 9
	sw	zero,-20(s0)
	.loc 1 96 9
	lw	a5,-40(s0)
	addi	a5,a5,-1
	sw	a5,-24(s0)
	.loc 1 97 11
	j	.L31
.L35:
.LBB7:
	.loc 1 98 34
	lw	a4,-24(s0)
	lw	a5,-20(s0)
	sub	a5,a4,a5
	.loc 1 98 41
	srli	a4,a5,31
	add	a5,a4,a5
	srai	a5,a5,1
	mv	a4,a5
	.loc 1 98 13
	lw	a5,-20(s0)
	add	a5,a5,a4
	sw	a5,-28(s0)
	.loc 1 99 19
	lw	a5,-28(s0)
	slli	a5,a5,2
	lw	a4,-36(s0)
	add	a5,a4,a5
	lw	a5,0(a5)
	.loc 1 99 12
	lw	a4,-44(s0)
	bne	a4,a5,.L32
	.loc 1 100 20
	lw	a5,-28(s0)
	j	.L33
.L32:
	.loc 1 102 19
	lw	a5,-28(s0)
	slli	a5,a5,2
	lw	a4,-36(s0)
	add	a5,a4,a5
	lw	a5,0(a5)
	.loc 1 102 12
	lw	a4,-44(s0)
	ble	a4,a5,.L34
	.loc 1 103 17
	lw	a5,-28(s0)
	addi	a5,a5,1
	sw	a5,-20(s0)
	j	.L31
.L34:
	.loc 1 105 18
	lw	a5,-28(s0)
	addi	a5,a5,-1
	sw	a5,-24(s0)
.L31:
.LBE7:
	.loc 1 97 16
	lw	a4,-20(s0)
	lw	a5,-24(s0)
	ble	a4,a5,.L35
	.loc 1 108 12
	li	a5,-1
.L33:
	.loc 1 109 1
	mv	a0,a5
	lw	ra,44(sp)
	.cfi_restore 1
	lw	s0,40(sp)
	.cfi_restore 8
	.cfi_def_cfa 2, 48
	addi	sp,sp,48
	.cfi_def_cfa_offset 0
	jr	ra
	.cfi_endproc
.LFE6:
	.size	binary_search, .-binary_search
	.section	.rodata
	.align	2
.LC0:
	.word	1
	.word	2
	.word	3
	.word	4
	.text
	.align	2
	.globl	main
	.type	main, @function
main:
.LFB7:
	.loc 1 112 1
	.cfi_startproc
	addi	sp,sp,-112
	.cfi_def_cfa_offset 112
	sw	ra,108(sp)
	sw	s0,104(sp)
	.cfi_offset 1, -4
	.cfi_offset 8, -8
	addi	s0,sp,112
	.cfi_def_cfa 8, 0
	.loc 1 113 9
	lui	a5,%hi(.LC0)
	addi	a5,a5,%lo(.LC0)
	lw	a2,0(a5)
	lw	a3,4(a5)
	lw	a4,8(a5)
	lw	a5,12(a5)
	sw	a2,-48(s0)
	sw	a3,-44(s0)
	sw	a4,-40(s0)
	sw	a5,-36(s0)
	.loc 1 117 19
	li	a5,3
	sw	a5,-72(s0)
	.loc 1 118 19
	li	a5,5
	sw	a5,-64(s0)
	.loc 1 119 19
	li	a5,7
	sw	a5,-56(s0)
	.loc 1 120 18
	addi	a5,s0,-72
	addi	a5,a5,8
	sw	a5,-68(s0)
	.loc 1 121 18
	addi	a5,s0,-72
	addi	a5,a5,16
	sw	a5,-60(s0)
	.loc 1 122 18
	sw	zero,-52(s0)
	.loc 1 124 17
	li	a5,20
	sw	a5,-108(s0)
	.loc 1 125 17
	li	a5,10
	sw	a5,-96(s0)
	.loc 1 126 17
	li	a5,30
	sw	a5,-84(s0)
	.loc 1 127 18
	addi	a5,s0,-108
	addi	a5,a5,12
	sw	a5,-104(s0)
	.loc 1 128 19
	addi	a5,s0,-108
	addi	a5,a5,24
	sw	a5,-100(s0)
	.loc 1 129 18
	sw	zero,-92(s0)
	.loc 1 130 19
	sw	zero,-88(s0)
	.loc 1 131 18
	sw	zero,-80(s0)
	.loc 1 132 19
	sw	zero,-76(s0)
	.loc 1 134 23
	addi	a5,s0,-48
	li	a1,4
	mv	a0,a5
	call	sum_array
	sw	a0,-20(s0)
	.loc 1 135 18
	addi	a5,s0,-72
	mv	a0,a5
	call	sum_list
	sw	a0,-24(s0)
	.loc 1 136 17
	addi	a5,s0,-108
	li	a1,30
	mv	a0,a5
	call	tree_find
	sw	a0,-28(s0)
	.loc 1 139 18
	addi	a5,s0,-72
	addi	a5,a5,16
	sw	a5,-68(s0)
	.loc 1 140 17
	addi	a5,s0,-72
	mv	a0,a5
	call	sum_list
	sw	a0,-32(s0)
	.loc 1 142 24
	lw	a4,-20(s0)
	lw	a5,-24(s0)
	add	a4,a4,a5
	.loc 1 142 33
	lw	a5,-28(s0)
	add	a4,a4,a5
	.loc 1 142 41
	lw	a5,-32(s0)
	add	a5,a4,a5
	.loc 1 143 1
	mv	a0,a5
	lw	ra,108(sp)
	.cfi_restore 1
	lw	s0,104(sp)
	.cfi_restore 8
	.cfi_def_cfa 2, 112
	addi	sp,sp,112
	.cfi_def_cfa_offset 0
	jr	ra
	.cfi_endproc
.LFE7:
	.size	main, .-main
.Letext0:
	.section	.debug_info,"",@progbits
.Ldebug_info0:
	.4byte	0x3ce
	.2byte	0x5
	.byte	0x1
	.byte	0x4
	.4byte	.Ldebug_abbrev0
	.uleb128 0xd
	.4byte	.LASF31
	.byte	0x1d
	.4byte	.LASF0
	.4byte	.LASF1
	.4byte	.Ltext0
	.4byte	.Letext0-.Ltext0
	.4byte	.Ldebug_line0
	.uleb128 0xa
	.4byte	.LASF4
	.byte	0x8
	.byte	0x5
	.4byte	0x4a
	.uleb128 0x6
	.4byte	.LASF2
	.byte	0x6
	.byte	0x9
	.4byte	0x4a
	.byte	0
	.uleb128 0x6
	.4byte	.LASF3
	.byte	0x7
	.byte	0x16
	.4byte	0x56
	.byte	0x4
	.byte	0
	.uleb128 0xe
	.byte	0x4
	.byte	0x5
	.string	"int"
	.uleb128 0xf
	.4byte	0x4a
	.uleb128 0x4
	.4byte	0x26
	.uleb128 0xb
	.4byte	.LASF4
	.byte	0x8
	.4byte	0x26
	.uleb128 0xa
	.4byte	.LASF5
	.byte	0xc
	.byte	0xa
	.4byte	0x96
	.uleb128 0x10
	.string	"key"
	.byte	0x1
	.byte	0xb
	.byte	0x9
	.4byte	0x4a
	.byte	0
	.uleb128 0x6
	.4byte	.LASF6
	.byte	0xc
	.byte	0x16
	.4byte	0x96
	.byte	0x4
	.uleb128 0x6
	.4byte	.LASF7
	.byte	0xd
	.byte	0x16
	.4byte	0x96
	.byte	0x8
	.byte	0
	.uleb128 0x4
	.4byte	0x65
	.uleb128 0xb
	.4byte	.LASF5
	.byte	0xe
	.4byte	0x65
	.uleb128 0x11
	.4byte	.LASF16
	.byte	0x1
	.byte	0x6f
	.byte	0x5
	.4byte	0x4a
	.4byte	.LFB7
	.4byte	.LFE7-.LFB7
	.uleb128 0x1
	.byte	0x9c
	.4byte	0x124
	.uleb128 0x1
	.4byte	.LASF8
	.byte	0x71
	.byte	0x9
	.4byte	0x124
	.uleb128 0x2
	.byte	0x91
	.sleb128 -48
	.uleb128 0x1
	.4byte	.LASF9
	.byte	0x72
	.byte	0xe
	.4byte	0x13b
	.uleb128 0x3
	.byte	0x91
	.sleb128 -72
	.uleb128 0x1
	.4byte	.LASF10
	.byte	0x73
	.byte	0xe
	.4byte	0x14b
	.uleb128 0x3
	.byte	0x91
	.sleb128 -108
	.uleb128 0x1
	.4byte	.LASF11
	.byte	0x86
	.byte	0x9
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -20
	.uleb128 0x1
	.4byte	.LASF12
	.byte	0x87
	.byte	0x9
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -24
	.uleb128 0x1
	.4byte	.LASF13
	.byte	0x88
	.byte	0x9
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -28
	.uleb128 0x1
	.4byte	.LASF14
	.byte	0x8c
	.byte	0x9
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -32
	.byte	0
	.uleb128 0x8
	.4byte	0x4a
	.4byte	0x134
	.uleb128 0x9
	.4byte	0x134
	.byte	0x3
	.byte	0
	.uleb128 0x12
	.byte	0x4
	.byte	0x7
	.4byte	.LASF15
	.uleb128 0x8
	.4byte	0x5b
	.4byte	0x14b
	.uleb128 0x9
	.4byte	0x134
	.byte	0x2
	.byte	0
	.uleb128 0x8
	.4byte	0x9b
	.4byte	0x15b
	.uleb128 0x9
	.4byte	0x134
	.byte	0x2
	.byte	0
	.uleb128 0x7
	.4byte	.LASF17
	.byte	0x5d
	.4byte	0x4a
	.4byte	.LFB6
	.4byte	.LFE6-.LFB6
	.uleb128 0x1
	.byte	0x9c
	.4byte	0x1d2
	.uleb128 0x2
	.4byte	.LASF8
	.byte	0x5d
	.byte	0x1e
	.4byte	0x1d2
	.uleb128 0x2
	.byte	0x91
	.sleb128 -36
	.uleb128 0x2
	.4byte	.LASF18
	.byte	0x5d
	.byte	0x2a
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -40
	.uleb128 0x2
	.4byte	.LASF19
	.byte	0x5d
	.byte	0x35
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -44
	.uleb128 0x3
	.string	"low"
	.byte	0x5f
	.byte	0x9
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -20
	.uleb128 0x1
	.4byte	.LASF20
	.byte	0x60
	.byte	0x9
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -24
	.uleb128 0x5
	.4byte	.LBB7
	.4byte	.LBE7-.LBB7
	.uleb128 0x1
	.4byte	.LASF21
	.byte	0x62
	.byte	0xd
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -28
	.byte	0
	.byte	0
	.uleb128 0x4
	.4byte	0x51
	.uleb128 0xc
	.4byte	.LASF22
	.byte	0x50
	.4byte	.LFB5
	.4byte	.LFE5-.LFB5
	.uleb128 0x1
	.byte	0x9c
	.4byte	0x242
	.uleb128 0x2
	.4byte	.LASF8
	.byte	0x50
	.byte	0x1a
	.4byte	0x242
	.uleb128 0x2
	.byte	0x91
	.sleb128 -36
	.uleb128 0x2
	.4byte	.LASF18
	.byte	0x50
	.byte	0x26
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -40
	.uleb128 0x5
	.4byte	.LBB5
	.4byte	.LBE5-.LBB5
	.uleb128 0x3
	.string	"i"
	.byte	0x52
	.byte	0xe
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -20
	.uleb128 0x5
	.4byte	.LBB6
	.4byte	.LBE6-.LBB6
	.uleb128 0x3
	.string	"key"
	.byte	0x53
	.byte	0xd
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -28
	.uleb128 0x3
	.string	"j"
	.byte	0x54
	.byte	0xd
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -24
	.byte	0
	.byte	0
	.byte	0
	.uleb128 0x4
	.4byte	0x4a
	.uleb128 0xc
	.4byte	.LASF23
	.byte	0x43
	.4byte	.LFB4
	.4byte	.LFE4-.LFB4
	.uleb128 0x1
	.byte	0x9c
	.4byte	0x2ac
	.uleb128 0x2
	.4byte	.LASF8
	.byte	0x43
	.byte	0x13
	.4byte	0x242
	.uleb128 0x2
	.byte	0x91
	.sleb128 -36
	.uleb128 0x2
	.4byte	.LASF18
	.byte	0x43
	.byte	0x1f
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -40
	.uleb128 0x1
	.4byte	.LASF6
	.byte	0x45
	.byte	0x9
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -20
	.uleb128 0x1
	.4byte	.LASF7
	.byte	0x46
	.byte	0x9
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -24
	.uleb128 0x5
	.4byte	.LBB4
	.4byte	.LBE4-.LBB4
	.uleb128 0x1
	.4byte	.LASF24
	.byte	0x48
	.byte	0xd
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -28
	.byte	0
	.byte	0
	.uleb128 0x7
	.4byte	.LASF25
	.byte	0x35
	.4byte	0x4a
	.4byte	.LFB3
	.4byte	.LFE3-.LFB3
	.uleb128 0x1
	.byte	0x9c
	.4byte	0x305
	.uleb128 0x2
	.4byte	.LASF8
	.byte	0x35
	.byte	0x18
	.4byte	0x1d2
	.uleb128 0x2
	.byte	0x91
	.sleb128 -36
	.uleb128 0x2
	.4byte	.LASF18
	.byte	0x35
	.byte	0x24
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -40
	.uleb128 0x1
	.4byte	.LASF26
	.byte	0x3a
	.byte	0x9
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -20
	.uleb128 0x5
	.4byte	.LBB3
	.4byte	.LBE3-.LBB3
	.uleb128 0x3
	.string	"i"
	.byte	0x3b
	.byte	0xe
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -24
	.byte	0
	.byte	0
	.uleb128 0x7
	.4byte	.LASF27
	.byte	0x23
	.4byte	0x4a
	.4byte	.LFB2
	.4byte	.LFE2-.LFB2
	.uleb128 0x1
	.byte	0x9c
	.4byte	0x33b
	.uleb128 0x2
	.4byte	.LASF28
	.byte	0x23
	.byte	0x19
	.4byte	0x33b
	.uleb128 0x2
	.byte	0x91
	.sleb128 -20
	.uleb128 0x13
	.string	"key"
	.byte	0x1
	.byte	0x23
	.byte	0x23
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -24
	.byte	0
	.uleb128 0x4
	.4byte	0x9b
	.uleb128 0x7
	.4byte	.LASF29
	.byte	0x19
	.4byte	0x4a
	.4byte	.LFB1
	.4byte	.LFE1-.LFB1
	.uleb128 0x1
	.byte	0x9c
	.4byte	0x375
	.uleb128 0x2
	.4byte	.LASF28
	.byte	0x19
	.byte	0x18
	.4byte	0x375
	.uleb128 0x2
	.byte	0x91
	.sleb128 -36
	.uleb128 0x3
	.string	"sum"
	.byte	0x1b
	.byte	0x9
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -20
	.byte	0
	.uleb128 0x4
	.4byte	0x5b
	.uleb128 0x14
	.4byte	.LASF30
	.byte	0x1
	.byte	0x10
	.byte	0x5
	.4byte	0x4a
	.4byte	.LFB0
	.4byte	.LFE0-.LFB0
	.uleb128 0x1
	.byte	0x9c
	.uleb128 0x2
	.4byte	.LASF8
	.byte	0x10
	.byte	0x1a
	.4byte	0x1d2
	.uleb128 0x2
	.byte	0x91
	.sleb128 -36
	.uleb128 0x2
	.4byte	.LASF18
	.byte	0x10
	.byte	0x26
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -40
	.uleb128 0x3
	.string	"sum"
	.byte	0x12
	.byte	0x9
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -20
	.uleb128 0x5
	.4byte	.LBB2
	.4byte	.LBE2-.LBB2
	.uleb128 0x3
	.string	"i"
	.byte	0x13
	.byte	0xe
	.4byte	0x4a
	.uleb128 0x2
	.byte	0x91
	.sleb128 -24
	.byte	0
	.byte	0
	.byte	0
	.section	.debug_abbrev,"",@progbits
.Ldebug_abbrev0:
	.uleb128 0x1
	.uleb128 0x34
	.byte	0
	.uleb128 0x3
	.uleb128 0xe
	.uleb128 0x3a
	.uleb128 0x21
	.sleb128 1
	.uleb128 0x3b
	.uleb128 0xb
	.uleb128 0x39
	.uleb128 0xb
	.uleb128 0x49
	.uleb128 0x13
	.uleb128 0x2
	.uleb128 0x18
	.byte	0
	.byte	0
	.uleb128 0x2
	.uleb128 0x5
	.byte	0
	.uleb128 0x3
	.uleb128 0xe
	.uleb128 0x3a
	.uleb128 0x21
	.sleb128 1
	.uleb128 0x3b
	.uleb128 0xb
	.uleb128 0x39
	.uleb128 0xb
	.uleb128 0x49
	.uleb128 0x13
	.uleb128 0x2
	.uleb128 0x18
	.byte	0
	.byte	0
	.uleb128 0x3
	.uleb128 0x34
	.byte	0
	.uleb128 0x3
	.uleb128 0x8
	.uleb128 0x3a
	.uleb128 0x21
	.sleb128 1
	.uleb128 0x3b
	.uleb128 0xb
	.uleb128 0x39
	.uleb128 0xb
	.uleb128 0x49
	.uleb128 0x13
	.uleb128 0x2
	.uleb128 0x18
	.byte	0
	.byte	0
	.uleb128 0x4
	.uleb128 0xf
	.byte	0
	.uleb128 0xb
	.uleb128 0x21
	.sleb128 4
	.uleb128 0x49
	.uleb128 0x13
	.byte	0
	.byte	0
	.uleb128 0x5
	.uleb128 0xb
	.byte	0x1
	.uleb128 0x11
	.uleb128 0x1
	.uleb128 0x12
	.uleb128 0x6
	.byte	0
	.byte	0
	.uleb128 0x6
	.uleb128 0xd
	.byte	0
	.uleb128 0x3
	.uleb128 0xe
	.uleb128 0x3a
	.uleb128 0x21
	.sleb128 1
	.uleb128 0x3b
	.uleb128 0xb
	.uleb128 0x39
	.uleb128 0xb
	.uleb128 0x49
	.uleb128 0x13
	.uleb128 0x38
	.uleb128 0xb
	.byte	0
	.byte	0
	.uleb128 0x7
	.uleb128 0x2e
	.byte	0x1
	.uleb128 0x3f
	.uleb128 0x19
	.uleb128 0x3
	.uleb128 0xe
	.uleb128 0x3a
	.uleb128 0x21
	.sleb128 1
	.uleb128 0x3b
	.uleb128 0xb
	.uleb128 0x39
	.uleb128 0x21
	.sleb128 5
	.uleb128 0x27
	.uleb128 0x19
	.uleb128 0x49
	.uleb128 0x13
	.uleb128 0x11
	.uleb128 0x1
	.uleb128 0x12
	.uleb128 0x6
	.uleb128 0x40
	.uleb128 0x18
	.uleb128 0x7a
	.uleb128 0x19
	.uleb128 0x1
	.uleb128 0x13
	.byte	0
	.byte	0
	.uleb128 0x8
	.uleb128 0x1
	.byte	0x1
	.uleb128 0x49
	.uleb128 0x13
	.uleb128 0x1
	.uleb128 0x13
	.byte	0
	.byte	0
	.uleb128 0x9
	.uleb128 0x21
	.byte	0
	.uleb128 0x49
	.uleb128 0x13
	.uleb128 0x2f
	.uleb128 0xb
	.byte	0
	.byte	0
	.uleb128 0xa
	.uleb128 0x13
	.byte	0x1
	.uleb128 0x3
	.uleb128 0xe
	.uleb128 0xb
	.uleb128 0xb
	.uleb128 0x3a
	.uleb128 0x21
	.sleb128 1
	.uleb128 0x3b
	.uleb128 0xb
	.uleb128 0x39
	.uleb128 0x21
	.sleb128 16
	.uleb128 0x1
	.uleb128 0x13
	.byte	0
	.byte	0
	.uleb128 0xb
	.uleb128 0x16
	.byte	0
	.uleb128 0x3
	.uleb128 0xe
	.uleb128 0x3a
	.uleb128 0x21
	.sleb128 1
	.uleb128 0x3b
	.uleb128 0xb
	.uleb128 0x39
	.uleb128 0x21
	.sleb128 3
	.uleb128 0x49
	.uleb128 0x13
	.byte	0
	.byte	0
	.uleb128 0xc
	.uleb128 0x2e
	.byte	0x1
	.uleb128 0x3f
	.uleb128 0x19
	.uleb128 0x3
	.uleb128 0xe
	.uleb128 0x3a
	.uleb128 0x21
	.sleb128 1
	.uleb128 0x3b
	.uleb128 0xb
	.uleb128 0x39
	.uleb128 0x21
	.sleb128 6
	.uleb128 0x27
	.uleb128 0x19
	.uleb128 0x11
	.uleb128 0x1
	.uleb128 0x12
	.uleb128 0x6
	.uleb128 0x40
	.uleb128 0x18
	.uleb128 0x7a
	.uleb128 0x19
	.uleb128 0x1
	.uleb128 0x13
	.byte	0
	.byte	0
	.uleb128 0xd
	.uleb128 0x11
	.byte	0x1
	.uleb128 0x25
	.uleb128 0xe
	.uleb128 0x13
	.uleb128 0xb
	.uleb128 0x3
	.uleb128 0x1f
	.uleb128 0x1b
	.uleb128 0x1f
	.uleb128 0x11
	.uleb128 0x1
	.uleb128 0x12
	.uleb128 0x6
	.uleb128 0x10
	.uleb128 0x17
	.byte	0
	.byte	0
	.uleb128 0xe
	.uleb128 0x24
	.byte	0
	.uleb128 0xb
	.uleb128 0xb
	.uleb128 0x3e
	.uleb128 0xb
	.uleb128 0x3
	.uleb128 0x8
	.byte	0
	.byte	0
	.uleb128 0xf
	.uleb128 0x26
	.byte	0
	.uleb128 0x49
	.uleb128 0x13
	.byte	0
	.byte	0
	.uleb128 0x10
	.uleb128 0xd
	.byte	0
	.uleb128 0x3
	.uleb128 0x8
	.uleb128 0x3a
	.uleb128 0xb
	.uleb128 0x3b
	.uleb128 0xb
	.uleb128 0x39
	.uleb128 0xb
	.uleb128 0x49
	.uleb128 0x13
	.uleb128 0x38
	.uleb128 0xb
	.byte	0
	.byte	0
	.uleb128 0x11
	.uleb128 0x2e
	.byte	0x1
	.uleb128 0x3f
	.uleb128 0x19
	.uleb128 0x3
	.uleb128 0xe
	.uleb128 0x3a
	.uleb128 0xb
	.uleb128 0x3b
	.uleb128 0xb
	.uleb128 0x39
	.uleb128 0xb
	.uleb128 0x27
	.uleb128 0x19
	.uleb128 0x49
	.uleb128 0x13
	.uleb128 0x11
	.uleb128 0x1
	.uleb128 0x12
	.uleb128 0x6
	.uleb128 0x40
	.uleb128 0x18
	.uleb128 0x7c
	.uleb128 0x19
	.uleb128 0x1
	.uleb128 0x13
	.byte	0
	.byte	0
	.uleb128 0x12
	.uleb128 0x24
	.byte	0
	.uleb128 0xb
	.uleb128 0xb
	.uleb128 0x3e
	.uleb128 0xb
	.uleb128 0x3
	.uleb128 0xe
	.byte	0
	.byte	0
	.uleb128 0x13
	.uleb128 0x5
	.byte	0
	.uleb128 0x3
	.uleb128 0x8
	.uleb128 0x3a
	.uleb128 0xb
	.uleb128 0x3b
	.uleb128 0xb
	.uleb128 0x39
	.uleb128 0xb
	.uleb128 0x49
	.uleb128 0x13
	.uleb128 0x2
	.uleb128 0x18
	.byte	0
	.byte	0
	.uleb128 0x14
	.uleb128 0x2e
	.byte	0x1
	.uleb128 0x3f
	.uleb128 0x19
	.uleb128 0x3
	.uleb128 0xe
	.uleb128 0x3a
	.uleb128 0xb
	.uleb128 0x3b
	.uleb128 0xb
	.uleb128 0x39
	.uleb128 0xb
	.uleb128 0x27
	.uleb128 0x19
	.uleb128 0x49
	.uleb128 0x13
	.uleb128 0x11
	.uleb128 0x1
	.uleb128 0x12
	.uleb128 0x6
	.uleb128 0x40
	.uleb128 0x18
	.uleb128 0x7a
	.uleb128 0x19
	.byte	0
	.byte	0
	.byte	0
	.section	.debug_aranges,"",@progbits
	.4byte	0x1c
	.2byte	0x2
	.4byte	.Ldebug_info0
	.byte	0x4
	.byte	0
	.2byte	0
	.2byte	0
	.4byte	.Ltext0
	.4byte	.Letext0-.Ltext0
	.4byte	0
	.4byte	0
	.section	.debug_line,"",@progbits
.Ldebug_line0:
	.section	.debug_str,"MS",@progbits,1
.LASF31:
	.string	"GNU C17 14.2.0 -mabi=ilp32 -mno-small-data-limit=0 -misa-spec=20191213 -march=rv32im -g -O0 -O0 -ffreestanding -fno-pie -fno-builtin -fno-inline"
.LASF8:
	.string	"values"
.LASF28:
	.string	"node"
.LASF11:
	.string	"array_total"
.LASF6:
	.string	"left"
.LASF30:
	.string	"sum_array"
.LASF7:
	.string	"right"
.LASF20:
	.string	"high"
.LASF4:
	.string	"ListNode"
.LASF27:
	.string	"tree_find"
.LASF12:
	.string	"before"
.LASF24:
	.string	"saved"
.LASF25:
	.string	"maximum"
.LASF16:
	.string	"main"
.LASF18:
	.string	"count"
.LASF22:
	.string	"insertion_sort"
.LASF13:
	.string	"found"
.LASF23:
	.string	"reverse"
.LASF21:
	.string	"middle"
.LASF29:
	.string	"sum_list"
.LASF19:
	.string	"target"
.LASF14:
	.string	"after"
.LASF9:
	.string	"list"
.LASF2:
	.string	"value"
.LASF10:
	.string	"tree"
.LASF26:
	.string	"largest"
.LASF15:
	.string	"unsigned int"
.LASF5:
	.string	"TreeNode"
.LASF17:
	.string	"binary_search"
.LASF3:
	.string	"next"
	.section	.debug_line_str,"MS",@progbits,1
.LASF0:
	.string	"/tmp/tmpkl0xk4iy/source.c"
.LASF1:
	.string	"/app"
	.ident	"GCC: (14.2.0+19) 14.2.0"
	.section	.note.GNU-stack,"",@progbits
