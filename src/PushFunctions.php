<?php

use MediaWiki\MediaWikiServices;

/**
 * Static class with utility methods for the Push extension.
 *
 * @since 0.2
 *
 * @file Push_Functions.php
 * @ingroup Push
 *
 * @author Jeroen De Dauw < jeroendedauw@gmail.com >
 */
final class PushFunctions
{
    /**
     * Returns the latest revision.
     * Has support for the ApprovedRevs extension, and will
     * return the latest approved revision where appropriate.
     *
     * @since 0.2
     *
     * @param Title $title
     *
     * @return int
     */
    public static function getRevisionToPush(Title $title)
    {
        if (defined("APPROVED_REVS_VERSION")) {
            $revId = ApprovedRevs::getApprovedRevID($title);
            return $revId ?: $title->getLatestRevID();
        }

        return $title->getLatestRevID();
    }

    /**
     * Expand a list of pages to include templates used in those pages.
     *
     * @since 0.4
     *
     * @param array $inputPages list of titles to look up
     * @param array $pageSet associative array indexed by titles for output
     *
     * @return array associative array index by titles
     */
    public static function getTemplates($inputPages, $pageSet)
    {
        return self::getLinks(
            $inputPages,
            $pageSet,
            "templatelinks",
            ["lt_namespace AS namespace", "lt_title AS title"],
            [
                "page_id=tl_from",
                "linktarget.lt_id = templatelinks.tl_target_id",
            ],
        );
    }

    /**
     * Expand a list of pages to include items used in those pages.
     *
     * @since 0.4
     *
     * @param array $inputPages Array of page titles (plain text, e.g. "Test:_Page2").
     * @param array $pageSet    The set that will be filled with prefixed titles.
     * @param string $table     Name of the intermediate table (e.g. 'templatelinks').
     * @param array  $fields    Columns to fetch – already fully qualified, e.g.:
     *                          ['lt_namespace AS namespace', 'lt_title AS title'].
     * @param array  $join      Join conditions that relate the three tables,
     *                          e.g. [
     *                            "page_id = tl_from",
     *                            "linktarget.lt_id = templatelinks.tl_target_id"
     *                          ].
     *
     * @return array The expanded set of prefixed titles.
     */
    protected static function getLinks(
        $inputPages,
        $pageSet,
        $table,
        $fields,
        $join,
    ) {
        /** @var IDatabase $dbr */
        $dbr = MediaWikiServices::getInstance()
            ->getDBLoadBalancer()
            ->getConnection(DB_REPLICA);

        // --------------------------------------------------------------------
        // Build the FROM/JOIN list once – it stays constant for every query.
        // --------------------------------------------------------------------
        $from = [
            "page", // core page table
            $table, // e.g. templatelinks
            "linktarget", // needed for lt_namespace / lt_title
        ];

        foreach ($inputPages as $page) {
            $title = Title::newFromText($page);
            if (!$title) {
                continue; // skip invalid titles
            }

            // Keep the page itself in the result set.
            $pageSet[$title->getPrefixedText()] = true;

            /* ------------------------------------------------------------------
               Build the WHERE/CONDITION array for this specific page:
               - The supplied `$join` array (string conditions)
               - Page‑specific filters: namespace + title
              ------------------------------------------------------------------ */
            $conds = array_merge($join, [
                "page_namespace" => $title->getNamespace(),
                "page_title" => $title->getDBkey(),
            ]);

            /* ------------------------------------------------------------------
               Execute the SELECT.
               The `$from` array is passed directly – MediaWiki will render it as:
                   FROM page
                        JOIN templatelinks
                        JOIN linktarget
               and apply the conditions in `$conds`.
              ------------------------------------------------------------------ */
            $result = $dbr->select($from, $fields, $conds, __METHOD__);

            foreach ($result as $row) {
                // `namespace` & `title` are already aliases from `$fields`
                $template = Title::makeTitle($row->namespace, $row->title);
                $pageSet[$template->getPrefixedText()] = true;
            }
        }

        return $pageSet;
    }

    /**
     * Function to change the keys of $egPushLoginUsers and $egPushLoginPasswords
     * from target url to target name using the $egPushTargets array.
     *
     * @since 0.5
     *
     * @param array &$arr
     * @param string $id Some string to identify the array and keep track of it having been flipped.
     */
    public static function flipKeys(array &$arr, $id)
    {
        static $handledArrays = [];

        if (!in_array($id, $handledArrays)) {
            $handledArrays[] = $id;

            global $egPushTargets;

            $flipped = [];

            foreach ($arr as $key => $value) {
                if (array_key_exists($key, $egPushTargets)) {
                    $flipped[$egPushTargets[$key]] = $value;
                }
            }

            $arr = $flipped;
        }
    }
}
