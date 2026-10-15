/* 体系目录：独立的纵深组织方式（与词条关联，不与横切分类维度挂钩）
 *
 * 结构：groups[] = 一级类 → children[] = 二级组 → words[] = 词汇
 *  - name      一级类名称，如「精准形容词」
 *  - subtitle  副标题，如「告别"不错、一般"」
 *  - credo     核心心法（可选）
 *  - practice  实操练习（可选）
 *  - words     词汇清单，按「词名」匹配 data.js，改词库无需改这里
 *
 * 扩充方式：往 groups 里加一个对象即可，页面自动渲染。
 */
window.VOCAB_TREE = {
  version: '2026-10-15',
  groups: [
    {
      id: 'adj-precise',
      name: '精准形容词',
      subtitle: '告别「不错、一般」',
      credo: '评价用词越精准立体，他人越能感受到你的认知与文字功底。',
      practice: '今日与人沟通夸赞时，把口语里的「真好」替换成本板块任意精准形容词。',
      children: [
        { id: 'adj-precise-good', name: '形容出彩、优质', words: ['到位', '得体', '扎实', '贴切', '稳妥', '融洽', '顺畅', '出彩'] },
        { id: 'adj-precise-lack', name: '形容欠缺、不足', words: ['生硬', '单薄', '牵强', '含糊', '唐突', '吃力', '局限'] },
        { id: 'adj-precise-feel', name: '形容内心感受', words: ['愉悦', '踏实', '宽慰', '顾虑', '纠结', '过意不去', '印象深刻'] }
      ]
    }
  ]
};
